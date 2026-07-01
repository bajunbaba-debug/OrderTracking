from __future__ import annotations

import argparse
import os
import shutil
import struct
import zipfile
from dataclasses import dataclass
from pathlib import Path


FREESECT = 0xFFFFFFFF
ENDOFCHAIN = 0xFFFFFFFE
FATSECT = 0xFFFFFFFD
DIFSECT = 0xFFFFFFFC


def u16(data: bytes, offset: int) -> int:
    return struct.unpack_from("<H", data, offset)[0]


def u32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def u64(data: bytes, offset: int) -> int:
    return struct.unpack_from("<Q", data, offset)[0]


@dataclass
class DirEntry:
    index: int
    name: str
    object_type: int
    color: int
    left: int
    right: int
    child: int
    start_sector: int
    size: int
    raw_offset: int


class CompoundFile:
    def __init__(self, data: bytes) -> None:
        self.data = bytearray(data)
        if self.data[:8] != bytes.fromhex("D0CF11E0A1B11AE1"):
            raise ValueError("Not an OLE Compound File")
        self.sector_shift = u16(self.data, 30)
        self.mini_sector_shift = u16(self.data, 32)
        self.sector_size = 1 << self.sector_shift
        self.mini_sector_size = 1 << self.mini_sector_shift
        self.num_fat_sectors = u32(self.data, 44)
        self.first_dir_sector = u32(self.data, 48)
        self.mini_stream_cutoff = u32(self.data, 56)
        self.first_mini_fat_sector = u32(self.data, 60)
        self.num_mini_fat_sectors = u32(self.data, 64)
        self.difat = [u32(self.data, 76 + i * 4) for i in range(109)]
        self.fat_sector_ids = [s for s in self.difat if s not in (FREESECT, ENDOFCHAIN, FATSECT, DIFSECT)]
        self.fat = self._load_fat()
        self.dir_entries = self._load_dir_entries()
        self.root = self.dir_entries[0]
        self.mini_fat = self._load_mini_fat()
        self.mini_stream = self._read_regular_stream(self.root.start_sector, self.root.size)

    def sector_offset(self, sector: int) -> int:
        return (sector + 1) * self.sector_size

    def _sector(self, sector: int) -> bytes:
        off = self.sector_offset(sector)
        return bytes(self.data[off : off + self.sector_size])

    def _load_fat(self) -> list[int]:
        fat: list[int] = []
        for sector in self.fat_sector_ids[: self.num_fat_sectors]:
            sec = self._sector(sector)
            fat.extend(struct.unpack("<" + "I" * (len(sec) // 4), sec))
        return fat

    def chain(self, start_sector: int) -> list[int]:
        if start_sector in (FREESECT, ENDOFCHAIN):
            return []
        chain: list[int] = []
        cur = start_sector
        seen: set[int] = set()
        while cur not in (FREESECT, ENDOFCHAIN):
            if cur in seen:
                raise ValueError("FAT chain loop")
            seen.add(cur)
            chain.append(cur)
            cur = self.fat[cur]
        return chain

    def _read_regular_stream(self, start_sector: int, size: int) -> bytes:
        chunks = [self._sector(s) for s in self.chain(start_sector)]
        return b"".join(chunks)[:size]

    def _load_dir_entries(self) -> list[DirEntry]:
        raw = self._read_regular_stream(self.first_dir_sector, 10**9)
        entries: list[DirEntry] = []
        for idx in range(0, len(raw) // 128):
            off = idx * 128
            entry = raw[off : off + 128]
            name_len = u16(entry, 64)
            if name_len >= 2:
                name = entry[: name_len - 2].decode("utf-16le", errors="replace")
            else:
                name = ""
            entries.append(
                DirEntry(
                    index=idx,
                    name=name,
                    object_type=entry[66],
                    color=entry[67],
                    left=u32(entry, 68),
                    right=u32(entry, 72),
                    child=u32(entry, 76),
                    start_sector=u32(entry, 116),
                    size=u64(entry, 120),
                    raw_offset=off,
                )
            )
        return entries

    def _load_mini_fat(self) -> list[int]:
        if self.first_mini_fat_sector in (FREESECT, ENDOFCHAIN):
            return []
        raw = self._read_regular_stream(self.first_mini_fat_sector, self.num_mini_fat_sectors * self.sector_size)
        return list(struct.unpack("<" + "I" * (len(raw) // 4), raw))

    def mini_chain(self, start_sector: int) -> list[int]:
        if start_sector in (FREESECT, ENDOFCHAIN):
            return []
        out: list[int] = []
        cur = start_sector
        seen: set[int] = set()
        while cur not in (FREESECT, ENDOFCHAIN):
            if cur in seen:
                raise ValueError("MiniFAT chain loop")
            seen.add(cur)
            out.append(cur)
            cur = self.mini_fat[cur]
        return out

    def read_stream(self, name: str) -> bytes:
        entry = next((e for e in self.dir_entries if e.name == name), None)
        if entry is None:
            raise KeyError(name)
        if entry.size < self.mini_stream_cutoff and entry.object_type == 2:
            chunks = []
            for mini in self.mini_chain(entry.start_sector):
                off = mini * self.mini_sector_size
                chunks.append(self.mini_stream[off : off + self.mini_sector_size])
            return b"".join(chunks)[: entry.size]
        return self._read_regular_stream(entry.start_sector, entry.size)

    def write_stream_same_size(self, name: str, content: bytes) -> None:
        entry = next((e for e in self.dir_entries if e.name == name), None)
        if entry is None:
            raise KeyError(name)
        if len(content) != entry.size:
            raise ValueError(f"replacement stream size {len(content)} != existing stream size {entry.size}")
        if entry.size < self.mini_stream_cutoff and entry.object_type == 2:
            for i, mini in enumerate(self.mini_chain(entry.start_sector)):
                off = mini * self.mini_sector_size
                self.mini_stream = (
                    self.mini_stream[:off]
                    + content[i * self.mini_sector_size : (i + 1) * self.mini_sector_size].ljust(self.mini_sector_size, b"\0")
                    + self.mini_stream[off + self.mini_sector_size :]
                )
            self.write_stream_same_size(self.root.name, self.mini_stream.ljust(self.root.size, b"\0")[: self.root.size])
            return
        for i, sector in enumerate(self.chain(entry.start_sector)):
            off = self.sector_offset(sector)
            chunk = content[i * self.sector_size : (i + 1) * self.sector_size].ljust(self.sector_size, b"\0")
            self.data[off : off + self.sector_size] = chunk

    def _write_fat_entry(self, sector: int, value: int) -> None:
        self.fat[sector] = value
        entries_per_sector = self.sector_size // 4
        fat_sector_index = sector // entries_per_sector
        if fat_sector_index >= len(self.fat_sector_ids):
            raise ValueError("Not enough FAT sectors to address appended stream sectors")
        fat_sector = self.fat_sector_ids[fat_sector_index]
        off = self.sector_offset(fat_sector) + (sector % entries_per_sector) * 4
        self.data[off : off + 4] = struct.pack("<I", value)

    def _update_dir_entry_size(self, entry: DirEntry, size: int) -> None:
        dir_chain = self.chain(self.first_dir_sector)
        sector_index = entry.raw_offset // self.sector_size
        sector_offset = entry.raw_offset % self.sector_size
        sector = dir_chain[sector_index]
        off = self.sector_offset(sector) + sector_offset + 120
        self.data[off : off + 8] = struct.pack("<Q", size)
        entry.size = size

    def write_regular_stream_resized(self, name: str, content: bytes) -> None:
        entry = next((e for e in self.dir_entries if e.name == name), None)
        if entry is None:
            raise KeyError(name)
        if entry.size < self.mini_stream_cutoff or entry.object_type != 2:
            raise ValueError(f"{name} is not a regular stream")

        chain = self.chain(entry.start_sector)
        needed = (len(content) + self.sector_size - 1) // self.sector_size
        if needed > len(chain):
            free = [i for i, value in enumerate(self.fat) if value == FREESECT and self.sector_offset(i) < len(self.data)]
            additional = needed - len(chain)
            if len(free) < additional:
                sector_count = len(self.data) // self.sector_size - 1
                appendable = [
                    i
                    for i in range(sector_count, len(self.fat))
                    if self.fat[i] == FREESECT and i not in free
                ]
                for sector in appendable[: additional - len(free)]:
                    expected_offset = self.sector_offset(sector)
                    if expected_offset != len(self.data):
                        raise ValueError(f"Cannot append non-contiguous sector {sector}")
                    self.data.extend(b"\0" * self.sector_size)
                    free.append(sector)
                if len(free) < additional:
                    raise ValueError(f"Need {additional} free sectors, found {len(free)}")
            new_sectors = free[:additional]
            if chain:
                self._write_fat_entry(chain[-1], new_sectors[0])
            else:
                entry.start_sector = new_sectors[0]
                raise ValueError("Starting a new stream is not supported")
            for left, right in zip(new_sectors, new_sectors[1:]):
                self._write_fat_entry(left, right)
            self._write_fat_entry(new_sectors[-1], ENDOFCHAIN)
            chain.extend(new_sectors)
        elif needed < len(chain):
            keep = chain[:needed]
            release = chain[needed:]
            self._write_fat_entry(keep[-1], ENDOFCHAIN)
            for sector in release:
                self._write_fat_entry(sector, FREESECT)
            chain = keep

        for i, sector in enumerate(chain):
            off = self.sector_offset(sector)
            chunk = content[i * self.sector_size : (i + 1) * self.sector_size].ljust(self.sector_size, b"\0")
            self.data[off : off + self.sector_size] = chunk
        self._update_dir_entry_size(entry, len(content))


def decompress_vba(data: bytes) -> bytes:
    if not data or data[0] != 0x01:
        raise ValueError("Invalid VBA compressed container signature")
    pos = 1
    out = bytearray()
    while pos < len(data):
        if pos + 2 > len(data):
            break
        header = u16(data, pos)
        pos += 2
        chunk_size = (header & 0x0FFF) + 3
        signature = header & 0x7000
        compressed = bool(header & 0x8000)
        if signature != 0x3000:
            raise ValueError(f"Invalid VBA chunk signature at {pos - 2}: 0x{header:04x}")
        chunk_end = pos + chunk_size - 2
        if chunk_end > len(data):
            chunk_end = len(data)
        if not compressed:
            out.extend(data[pos:chunk_end])
            pos = chunk_end
            continue
        chunk_start_out = len(out)
        while pos < chunk_end:
            flag = data[pos]
            pos += 1
            for bit in range(8):
                if pos >= chunk_end:
                    break
                if not (flag & (1 << bit)):
                    out.append(data[pos])
                    pos += 1
                else:
                    token = u16(data, pos)
                    pos += 2
                    decompressed_current = len(out) - chunk_start_out
                    bit_count = max(4, (decompressed_current.bit_length()))
                    length_mask = 0xFFFF >> bit_count
                    offset_mask = (~length_mask) & 0xFFFF
                    length = (token & length_mask) + 3
                    offset = ((token & offset_mask) >> (16 - bit_count)) + 1
                    copy_src = len(out) - offset
                    for _ in range(length):
                        out.append(out[copy_src])
                        copy_src += 1
    return bytes(out)


def compressed_size_for_literal_payload(n: int) -> int:
    full, rem = divmod(n, 4096)
    chunks = full + (1 if rem else 0)
    return 1 + n + chunks * 2


def build_literal_container_exact_size(text: bytes, target_size: int) -> bytes:
    n = len(text)
    chosen = None
    for total_payload in range(n, n + 20000):
        if compressed_size_for_literal_payload(total_payload) == target_size:
            chosen = total_payload
            break
    if chosen is None:
        raise ValueError(f"Cannot create literal VBA container of exact size {target_size}")
    payload = text + (b"\r\n" * ((chosen - n + 1) // 2))[: chosen - n]
    out = bytearray([0x01])
    pos = 0
    while pos < len(payload):
        chunk = payload[pos : pos + 4096]
        pos += len(chunk)
        header = 0x3000 | ((len(chunk) + 2 - 3) & 0x0FFF)
        out.extend(struct.pack("<H", header))
        out.extend(chunk)
    if len(out) != target_size:
        raise AssertionError((len(out), target_size))
    return bytes(out)


def encode_vba_compressed_container(text: bytes) -> bytes:
    out = bytearray([0x01])
    for chunk_start in range(0, len(text), 4096):
        raw = text[chunk_start : chunk_start + 4096]
        encoded = bytearray()
        pos = 0
        while pos < len(raw):
            flag_index = len(encoded)
            encoded.append(0)
            flags = 0
            for bit in range(8):
                if pos >= len(raw):
                    break
                best_len = 0
                best_offset = 0
                decompressed_current = pos
                bit_count = max(4, decompressed_current.bit_length())
                length_mask = 0xFFFF >> bit_count
                max_len = min(length_mask + 3, len(raw) - pos)
                max_offset = min(pos, 1 << bit_count)
                if max_len >= 3 and max_offset > 0:
                    for offset in range(1, max_offset + 1):
                        length = 0
                        while length < max_len and raw[pos - offset + length] == raw[pos + length]:
                            length += 1
                        if length > best_len and length >= 3:
                            best_len = length
                            best_offset = offset
                            if best_len == max_len:
                                break
                if best_len >= 3:
                    token = ((best_offset - 1) << (16 - bit_count)) | (best_len - 3)
                    encoded.extend(struct.pack("<H", token))
                    flags |= 1 << bit
                    pos += best_len
                else:
                    encoded.append(raw[pos])
                    pos += 1
            encoded[flag_index] = flags
        if len(encoded) < len(raw):
            header = 0x3000 | 0x8000 | ((len(encoded) - 1) & 0x0FFF)
            out.extend(struct.pack("<H", header))
            out.extend(encoded)
        else:
            header = 0x3000 | ((len(raw) - 1) & 0x0FFF)
            out.extend(struct.pack("<H", header))
            out.extend(raw)
    return bytes(out)


def make_padding_payload(n: int) -> bytes:
    if n <= 0:
        return b""
    pattern = b"\r\n' upload padding\r\n"
    payload = (pattern * ((n // len(pattern)) + 1))[:n]
    return payload


def append_valid_padding_chunks(container: bytes, target_size: int) -> bytes | None:
    remaining = target_size - len(container)
    if remaining == 0:
        return container
    if remaining < 3:
        return None
    out = bytearray(container)
    while remaining > 0:
        if remaining < 3:
            return None
        payload_len = min(4096, remaining - 2)
        if remaining - (payload_len + 2) in (1, 2):
            payload_len -= 3
        if payload_len <= 0:
            return None
        payload = make_padding_payload(payload_len)
        header = 0x3000 | ((len(payload) - 1) & 0x0FFF)
        out.extend(struct.pack("<H", header))
        out.extend(payload)
        remaining -= len(payload) + 2
    return bytes(out)


def build_compressed_container_exact_size(text: bytes, target_size: int) -> bytes:
    base = encode_vba_compressed_container(text)
    if len(base) > target_size:
        raise ValueError(f"Compressed VBA stream is {len(base)} bytes, exceeds target {target_size}")
    padded = append_valid_padding_chunks(base, target_size)
    if padded is not None:
        return padded
    for extra in range(1, 128):
        base = encode_vba_compressed_container(text + (b"\r\n" * extra))
        if len(base) <= target_size:
            padded = append_valid_padding_chunks(base, target_size)
            if padded is not None:
                return padded
    raise ValueError(f"Cannot create VBA container of exact size {target_size}")


def find_code_offset(stream: bytes) -> int:
    for offset, byte in enumerate(stream):
        if byte != 0x01:
            continue
        try:
            text = decompress_vba(stream[offset:])
        except Exception:
            continue
        if b"Attribute VB_Name" in text[:600]:
            return offset
    raise ValueError("VBA compressed code offset not found")


def get_module_code(cf: CompoundFile, stream_name: str) -> tuple[bytes, int, bytes, str]:
    stream = cf.read_stream(stream_name)
    offset = find_code_offset(stream)
    code_bytes = decompress_vba(stream[offset:])
    return stream, offset, code_bytes, code_bytes.decode("cp1252", errors="replace")


def write_module_code(
    cf: CompoundFile, stream_name: str, original_stream: bytes, offset: int, code: str, allow_resize: bool = False
) -> None:
    prefix = original_stream[:offset]
    code_bytes = code.encode("cp1252", errors="replace")
    if allow_resize:
        encoded = encode_vba_compressed_container(code_bytes)
    else:
        target_size = len(original_stream) - offset
        encoded = build_compressed_container_exact_size(code_bytes, target_size)
    round_trip = decompress_vba(encoded).decode("cp1252", errors="replace")
    if not round_trip.startswith(code):
        raise AssertionError(f"{stream_name} VBA round trip failed")
    content = prefix + encoded
    if allow_resize and len(content) != len(original_stream):
        cf.write_regular_stream_resized(stream_name, content)
    else:
        cf.write_stream_same_size(stream_name, content)


def patch_button_code(original: str, replacement: str) -> str:
    marker = "Private Sub CommandButton3_Click()"
    start = original.find(marker)
    if start < 0:
        raise ValueError("CommandButton3_Click not found")
    end = original.find("End Sub", start)
    if end < 0:
        raise ValueError("End Sub not found after CommandButton3_Click")
    end += len("End Sub")
    return original[:start] + replacement.strip() + original[end:]


def upsert_upload_module(original: str, helper_code: str) -> str:
    marker = "' OrderTracking upload helper"
    start = original.find(marker)
    if start >= 0:
        return original[:start].rstrip() + "\r\n\r\n" + helper_code.strip() + "\r\n"
    return original.rstrip() + "\r\n\r\n" + helper_code.strip() + "\r\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--url", default="http://101.132.145.160/api/import")
    parser.add_argument("--password", default="tt996")
    args = parser.parse_args()

    wb_path = args.workbook
    backup = wb_path.with_suffix(wb_path.suffix + ".bak")
    if not backup.exists():
        shutil.copy2(wb_path, backup)

    with zipfile.ZipFile(wb_path, "r") as zin:
        vba = zin.read("xl/vbaProject.bin")
        all_items = {info.filename: zin.read(info.filename) for info in zin.infolist()}
        infos = zin.infolist()

    cf = CompoundFile(vba)
    sheet_stream, sheet_offset, _sheet_bytes, sheet_code = get_module_code(cf, "Sheet1")
    module_stream, module_offset, _module_bytes, module_code = get_module_code(cf, "模块1")

    button_replacement = '''
Private Sub CommandButton3_Click()
    UploadCurrentWorkbookToOrderTracking
End Sub
'''

    helper_code = f'''
' OrderTracking upload helper
Public Sub UploadCurrentWorkbookToOrderTracking()
    Const IMPORT_URL As String = "{args.url}"
    Const LOGIN_URL As String = "http://101.132.145.160/api/auth/session"
    Const ADMIN_USER As String = "admin"
    Const ADMIN_PASSWORD As String = "{args.password}"

    Dim workbookPath As String
    Dim boundary As String
    Dim requestBody() As Byte
    Dim fileBytes() As Byte
    Dim preamble() As Byte
    Dim epilogue() As Byte
    Dim sessionCookie As String
    Dim http As Object
    Dim responseText As String

    On Error GoTo ErrHandler

    If Len(ThisWorkbook.Path) = 0 Then
        MsgBox "Please save this workbook before uploading.", vbExclamation
        Exit Sub
    End If

    ThisWorkbook.Save
    workbookPath = ThisWorkbook.FullName
    Application.StatusBar = "Logging in to OrderTracking..."

    sessionCookie = OrderTrackingLogin(LOGIN_URL, ADMIN_USER, ADMIN_PASSWORD)
    If Len(sessionCookie) = 0 Then
        Application.StatusBar = False
        MsgBox "Login failed: session cookie was not returned.", vbExclamation
        Exit Sub
    End If

    Application.StatusBar = "Uploading current workbook..."
    fileBytes = ReadBinaryFile(workbookPath)
    boundary = "----OrderTrackingExcelUpload" & Format(Now, "yyyymmddhhnnss")
    preamble = TextBytes("--" & boundary & vbCrLf & _
        "Content-Disposition: form-data; name=""file""; filename=""project-stats-2026.xlsm""" & vbCrLf & _
        "Content-Type: application/vnd.ms-excel.sheet.macroEnabled.12" & vbCrLf & vbCrLf)
    epilogue = TextBytes(vbCrLf & "--" & boundary & "--" & vbCrLf)
    requestBody = JoinBytes(preamble, fileBytes, epilogue)

    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "POST", IMPORT_URL, False
    http.setRequestHeader "Content-Type", "multipart/form-data; boundary=" & boundary
    http.setRequestHeader "Cookie", sessionCookie
    http.send requestBody

    responseText = CStr(http.responseText)
    Application.StatusBar = False
    If http.Status >= 200 And http.Status < 300 Then
        MsgBox "Upload and import succeeded." & vbCrLf & responseText, vbInformation
    Else
        MsgBox "Upload failed, HTTP " & http.Status & vbCrLf & responseText, vbExclamation
    End If
    Exit Sub

ErrHandler:
    Application.StatusBar = False
    MsgBox "Upload failed: " & Err.Description, vbExclamation
End Sub

Private Function OrderTrackingLogin(ByVal loginUrl As String, ByVal userName As String, ByVal password As String) As String
    Dim http As Object
    Dim payload As String
    Dim headers As String
    Dim lines() As String
    Dim i As Long
    Dim line As String
    Dim cookieValue As String

    payload = "{{""username"":""" & JsonEscape(userName) & """,""password"":""" & JsonEscape(password) & """}}"
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "POST", loginUrl, False
    http.setRequestHeader "Content-Type", "application/json"
    http.send TextBytes(payload)

    If http.Status < 200 Or http.Status >= 300 Then
        OrderTrackingLogin = ""
        Exit Function
    End If

    headers = http.getAllResponseHeaders()
    lines = Split(headers, vbCrLf)
    For i = LBound(lines) To UBound(lines)
        line = lines(i)
        If LCase$(Left$(line, 11)) = "set-cookie:" Then
            cookieValue = Trim$(Mid$(line, 12))
            If InStr(1, cookieValue, ";", vbTextCompare) > 0 Then
                cookieValue = Left$(cookieValue, InStr(1, cookieValue, ";", vbTextCompare) - 1)
            End If
            If Len(cookieValue) > 0 Then
                OrderTrackingLogin = cookieValue
                Exit Function
            End If
        End If
    Next i
    OrderTrackingLogin = ""
End Function

Private Function ReadBinaryFile(ByVal filePath As String) As Byte()
    Dim stream As Object
    Set stream = CreateObject("ADODB.Stream")
    stream.Type = 1
    stream.Open
    stream.LoadFromFile filePath
    ReadBinaryFile = stream.Read
    stream.Close
End Function

Private Function TextBytes(ByVal text As String) As Byte()
    TextBytes = StrConv(text, vbFromUnicode)
End Function

Private Function JoinBytes(ByRef firstPart() As Byte, ByRef middlePart() As Byte, ByRef lastPart() As Byte) As Byte()
    Dim result() As Byte
    Dim offset As Long
    ReDim result(0 To UBound(firstPart) + UBound(middlePart) + UBound(lastPart) + 2)
    CopyBytes result, offset, firstPart
    CopyBytes result, offset, middlePart
    CopyBytes result, offset, lastPart
    JoinBytes = result
End Function

Private Sub CopyBytes(ByRef target() As Byte, ByRef offset As Long, ByRef source() As Byte)
    Dim i As Long
    For i = LBound(source) To UBound(source)
        target(offset) = source(i)
        offset = offset + 1
    Next i
End Sub

Private Function JsonEscape(ByVal value As String) As String
    JsonEscape = Replace(Replace(value, "\\", "\\\\"), Chr$(34), "\\" & Chr$(34))
End Function
'''

    new_sheet_code = patch_button_code(sheet_code, button_replacement)
    new_module_code = upsert_upload_module(module_code, helper_code)
    write_module_code(cf, "Sheet1", sheet_stream, sheet_offset, new_sheet_code)
    write_module_code(cf, "模块1", module_stream, module_offset, new_module_code, allow_resize=True)
    all_items["xl/vbaProject.bin"] = bytes(cf.data)

    temp = wb_path.with_suffix(wb_path.suffix + ".tmp")
    with zipfile.ZipFile(temp, "w") as zout:
        for info in infos:
            zi = zipfile.ZipInfo(info.filename, info.date_time)
            zi.compress_type = info.compress_type
            zi.external_attr = info.external_attr
            zi.comment = info.comment
            zout.writestr(zi, all_items[info.filename])
    os.replace(temp, wb_path)
    print(f"Patched {wb_path}")
    print(f"Backup {backup}")
    print(f"Sheet1 VBA chars: {len(sheet_code)} -> {len(new_sheet_code)}")
    print(f"模块1 VBA chars: {len(module_code)} -> {len(new_module_code)}")


if __name__ == "__main__":
    main()

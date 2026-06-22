import { NextRequest, NextResponse } from "next/server";
import { getAllProjectsSerialized } from "@/lib/analytics";
import { parseProjectBody } from "@/lib/project-input";
import { upsertProject } from "@/lib/project-service";
import { formatValidationErrors, validateProjectRow } from "@/lib/project-validation";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const designStatus = params.get("designStatus");
  const owner = params.get("owner");
  const type = params.get("type");
  const dueBucket = params.get("dueBucket");
  const search = params.get("search")?.trim().toLowerCase();

  let items = await getAllProjectsSerialized();

  if (designStatus) items = items.filter((i) => i.designStatus === designStatus);
  if (owner) items = items.filter((i) => i.owner === owner);
  if (type) items = items.filter((i) => i.type === type);
  if (dueBucket) items = items.filter((i) => i.dueBucket === dueBucket);
  if (search) {
    items = items.filter(
      (i) =>
        i.contractNo.toLowerCase().includes(search) ||
        i.projectName.toLowerCase().includes(search) ||
        i.model.toLowerCase().includes(search)
    );
  }

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const row = parseProjectBody(body);
  const validation = validateProjectRow(row);
  if (!validation.ok) {
    return NextResponse.json(
      { error: formatValidationErrors(validation.errors) },
      { status: 400 }
    );
  }

  const created = await upsertProject(null, row);
  return NextResponse.json(created, { status: 201 });
}

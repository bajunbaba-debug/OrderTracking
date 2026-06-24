/** 服务端「今天」日期（Asia/Shanghai，yyyy-MM-dd） */
export function getServerTodayInShanghai(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

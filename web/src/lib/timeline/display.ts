const YEAR_IN_LABEL = /(?:19|20)\d{2}/;

/** 全部概览图块：从首个年份之后的主体显示，隐藏前缀合同号 */
export function compactOverviewBlockLabel(label: string, maxLen = 28): string {
  const match = YEAR_IN_LABEL.exec(label);
  if (match) {
    const afterYear = label.slice(match.index + match[0].length);
    const trimmed = afterYear.replace(/^[-_./\\]+/, "");
    if (trimmed) {
      return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;
    }
    const withYear = label.slice(match.index);
    return withYear.length > maxLen ? `${withYear.slice(0, maxLen)}…` : withYear;
  }
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen)}…`;
}

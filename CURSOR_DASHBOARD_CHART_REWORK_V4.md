# V4 Rework: Restore The Dashboard Chart Body

Work in `/Users/jhonsimsim/MVP/OrderTracking/web`.

The user says the dashboard chart was removed: the "处理中" area now shows only the data matrix/list below the chart. This is wrong. Do not validate only by checking DOM text. You must use the browser and confirm the visible chart body exists.

## Required Fixes

1. Restore the real "处理中" chart on the dashboard `/`.
   - Use the existing chart library `recharts`.
   - The default dashboard view must show a real grouped bar chart.
   - The visible chart must include bars, axes, and legend.
   - Recharts SVG must have real width/height and must not be clipped by parent layout.
   - Do not show only the chart data matrix/list.

2. Hide the chart data matrix by default.
   - The data matrix below the chart must be hidden on first load.
   - Add an icon button to show/hide that matrix.
   - Clicking the icon shows the matrix; clicking again hides it.

3. Implement the dashboard switch between two vertical/sliding sections:
   - `处理中`: default view, shows the real grouped bar chart.
   - `负载排行`: shows area A.

4. Area A must contain exactly these three tables in one row on desktop:
   - `成员负载排行（未完成）`
   - `成员负载排行（已完成）`
   - `产品类型负载排行（未完成）`

5. Do not break existing features:
   - Dashboard stat cards.
   - Due cards link to filtered detail pages.
   - Member analysis `未完成负载 / 总负载` toggle.
   - Member analysis P1/P10/P110/P220 display.
   - Type analysis: P1 average and P10 must use the same calculation basis and should be equal when they represent the same average.

## Files To Inspect

- `src/app/page.tsx`
- `src/components/DashboardMemberTypeChart.tsx`
- `src/components/DashboardWorkloadPanel.tsx`
- `src/lib/analytics.ts`
- Any CSS that affects chart/container height, overflow, display, or visibility.

## Required Commands

Run:

```bash
npm run lint
npm run build
```

## Required Browser Verification

Start the dev server and verify `http://localhost:3000/` in the browser:

1. Default dashboard view shows the actual `处理中` grouped bar chart body.
2. Bars, axes, and legend are visibly rendered.
3. The data matrix below the chart is hidden by default.
4. The matrix toggle icon shows and hides the matrix.
5. Clicking `负载排行` shows the three side-by-side tables.
6. Clicking `处理中` returns to the visible chart.

Also verify:

1. `http://localhost:3000/members` defaults to `未完成负载`.
2. `http://localhost:3000/members?load=all` shows `总负载`.

## Reply Format

Reply with:

1. Files changed.
2. `npm run lint` result.
3. `npm run build` result.
4. Browser verification result, explicitly saying whether the visible chart body exists.
5. Any remaining warnings and whether they are related to this change.

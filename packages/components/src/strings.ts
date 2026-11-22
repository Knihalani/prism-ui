export function formatComponentMessage(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => Object.hasOwn(values, key) ? values[key] : placeholder);
}

export const componentStrings = {
  "artifact": {
    "updating": "Updating…",
    "artifactVersion": "Artifact version",
    "v": "v",
    "changes": "Changes",
    "copy": "Copy",
    "reloadPreview": "Reload preview",
    "exitFullscreen": "Exit fullscreen",
    "openFullscreen": "Open fullscreen",
    "previewDisabled": "Preview disabled",
    "preparingPreview": "Preparing preview",
    "previewCouldnTRun": "Preview couldn’t run",
    "fixThis": "Fix this",
    "sourceChanges": "Source changes",
    "artifactSource": "Artifact source",
    "inlineArtifacts": "Inline artifacts",
    "harness": "Harness",
    "gallery": "Gallery",
    "stream": "Stream",
    "finish": "Finish",
    "streamUpdate": "Stream update",
    "version2": "Version 2",
    "error": "Error",
    "dark": "Dark",
    "light": "Light"
  },
  "ask": {
    "nbsp": "\u00a0"
  },
  "callout": {
    "label": "Callout",
    "askAboutThis": "Ask about this"
  },
  "card": {
    "selectMessage": "User select in card: {payload}",
    "askAboutThis": "Ask about this",
    "sent": "Sent"
  },
  "chart": {
    "askAboutThisChart": "Ask about this chart",
    "undoChartChange": "Undo chart change",
    "chartViews": "Chart views",
    "noChartData": "No chart data",
    "loadingChart": "Loading chart…",
    "series": "Series",
    "data": "data"
  },
  "codeblock": {
    "copyFailed": "Copy failed",
    "plainText": "Plain text",
    "showAll": "Show all {count} lines",
    "copyMessage": "User copy in code: {payload}",
    "languageJs": "JavaScript",
    "languageTs": "TypeScript",
    "languagePy": "Python",
    "languageSh": "Shell",
    "copyCode": "Copy code",
    "copied": "Copied",
    "copy": "Copy",
    "toggleLineWrap": "Toggle line wrap",
    "wrapLines": "Wrap lines",
    "askAboutThisCode": "Ask about this code",
    "streaming": "Streaming…",
    "showLess": "Show less"
  },
  "datatable": {
    "askAboutThisTable": "Ask about this table",
    "undoTableChange": "Undo table change",
    "filterRows": "Filter rows",
    "filterRows2": "Filter rows…",
    "showEssentialColumns": "Show essential columns",
    "showAllColumns": "Show all columns ↔",
    "selectAllRowsOnPage": "Select all rows on page",
    "noRowsYet": "No rows yet",
    "clearFilter": "Clear filter",
    "noRowsSelected": "No rows selected",
    "previousPage": "Previous page",
    "nextPage": "Next page",
    "sent": "Sent · {count}"
  },
  "runbook": {
    "nbsp": "\u00a0"
  },
  "summary": {
    "title": "Summary",
    "actionItem": "Action item ",
    "sent": "Sent",
    "sendMessage": "Please send these {count} action items: {items}.",
    "askPointMessage": "Tell me more about this point: {text}",
    "of": " of ",
    "complete": " complete",
    "sendActionItems": "Send action items",
    "askAboutPoint": "Ask about point ",
    "askAboutThis": "Ask about this",
    "source": "Source ",
    "noSummaryPointsYet": "No summary points yet.",
    "actionItems": "Action items",
    "noActionItems": "No action items."
  },
  "table": {
    "tablePagination": "Table pagination",
    "previousPage": "Previous page",
    "pageStatus": "Page {page} of {pages}",
    "nextPage": "Next page"
  },
  "grid": { "label": "Grid" },
  "tabs": {
    "tablistLabel": "Tabs",
    "loadingTab": "Loading tab"
  }
};

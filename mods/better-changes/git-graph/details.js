const MIN_DETAILS_HEIGHT = 120;
const GRAPH_CONTENT_MIN_HEIGHT = 100;

export function resizedDetailsHeight(startHeight, deltaY, graphHeight) {
  const maxHeight = Math.max(MIN_DETAILS_HEIGHT, graphHeight - GRAPH_CONTENT_MIN_HEIGHT);
  return Math.min(maxHeight, Math.max(MIN_DETAILS_HEIGHT, startHeight - deltaY));
}

export function isAllowed(rules, request) {
  for (const rule of rules) {
    if (!actionMatches(rule.action, request.action)) continue;
    if (!resourceMatches(rule.resource, request.resource)) continue;
    return rule.effect === 'allow';
  }

  return false;
}

function actionMatches(pattern, action) {
  return pattern === '*' || pattern === action;
}

function resourceMatches(pattern, resource) {
  if (pattern.endsWith('/*')) {
    return resource.startsWith(pattern.slice(0, -2));
  }
  return pattern === resource;
}

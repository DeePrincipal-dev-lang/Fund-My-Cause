export function randomString() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'C';
  for (let i = 0; i < 55; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function beforeRequest(requestParams, context, ee, next) {
  // Add auth token if needed
  if (context.vars.authToken) {
    requestParams.headers = requestParams.headers || {};
    requestParams.headers['Authorization'] = `Bearer ${context.vars.authToken}`;
  }
  return next();
}

export function afterResponse(requestParams, response, context, ee, next) {
  // Track custom metrics
  if (response.statusCode >= 500) {
    ee.emit('counter', 'errors.5xx', 1);
  }
  return next();
}

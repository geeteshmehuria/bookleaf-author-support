/** Where each role lands after login. The role comes from the API, never from the URL. */
const ROLE_HOME = {
  author: "/author",
  admin: "/admin",
}

export const homeFor = (role) => ROLE_HOME[role] ?? "/"

/**
 * After login, go back to the page the user tried to open, but only if it belongs
 * to their own area (an author bounced from /admin goes to /author, not /admin).
 */
export function destinationAfterLogin(user, from) {
  const home = homeFor(user.role)
  const path = from?.pathname
  return path && (path === home || path.startsWith(`${home}/`)) ? path + (from.search ?? "") : home
}

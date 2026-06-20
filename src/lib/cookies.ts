// Name of the cookie that holds the Appwrite session secret.
// Kept in its own dependency-free module so it can be imported from both
// server code and the (edge) middleware without pulling in node-appwrite.
export const SESSION_COOKIE = "relay_session";

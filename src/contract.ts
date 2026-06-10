/**
 * AUTO-GENERATED — DO NOT EDIT.
 * This is the shared API contract for this app, regenerated from the plan on
 * every build. Both the frontend (@/contract) and the backend (./contract)
 * import these types so the request/response shapes can never drift.
 */


export interface User {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** ISO timestamp when the user was created */
  createdAt: string;
}

export interface OtpCode {
  /** Unique record identifier */
  id: string;
  /** Email address the code was sent to */
  email: string;
  /** The 6-digit one-time code */
  code: string;
  /** ISO timestamp when the code expires */
  expiresAt: string;
  /** ISO timestamp when the code was created */
  createdAt: string;
}

export interface Todo {
  /** Unique todo identifier */
  id: string;
  /** The owner's user id */
  userId: string;
  /** Short title of the todo */
  title: string;
  /** Optional longer description or notes */
  notes?: string;
  /** ISO date string for the due date, or null */
  dueDate?: string | null;
  /** Whether the todo is marked done */
  completed: boolean;
  /** ISO timestamp when the todo was created */
  createdAt: string;
  /** ISO timestamp when the todo was last updated */
  updatedAt: string;
}

export interface ApiContract {
  "auth-request-code": { method: "POST"; path: "/api/auth/request-code"; request: { email: string }; response: { ok: boolean } };
  "auth-verify-code": { method: "POST"; path: "/api/auth/verify-code"; request: { email: string; code: string }; response: { token: string; user: User } };
  "auth-me": { method: "GET"; path: "/api/auth/me"; request: void; response: User };
  "list-todos": { method: "GET"; path: "/api/todos"; request: void; response: Todo[] };
  "create-todo": { method: "POST"; path: "/api/todos"; request: Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>; response: Todo };
  "update-todo": { method: "PATCH"; path: "/api/todos/:id"; request: Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>; response: Todo };
  "delete-todo": { method: "DELETE"; path: "/api/todos/:id"; request: void; response: void };
}

export const API_ROUTES = {
  "auth-request-code": { method: "POST", path: "/api/auth/request-code" },
  "auth-verify-code": { method: "POST", path: "/api/auth/verify-code" },
  "auth-me": { method: "GET", path: "/api/auth/me" },
  "list-todos": { method: "GET", path: "/api/todos" },
  "create-todo": { method: "POST", path: "/api/todos" },
  "update-todo": { method: "PATCH", path: "/api/todos/:id" },
  "delete-todo": { method: "DELETE", path: "/api/todos/:id" },
} as const;

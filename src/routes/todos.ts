import { Router, type Response } from 'express';
import type { Db } from 'mongodb';
import crypto from 'crypto';
import type { Todo } from '../contract';
import { requireAuth, type AuthRequest } from '../middleware/auth';

export function createTodosRouter(db: Db): Router {
  const router = Router();

  // All todos routes require authentication
  router.use(requireAuth);

  const todos = db.collection<Omit<Todo, 'id'> & { _id?: unknown }>('todos');

  // ── GET /api/todos ───────────────────────────────────────────────────────
  // Returns all todos for the authenticated user, newest first.
  router.get('/', async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const docs = await todos
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

      const result: Todo[] = docs.map((doc) => ({
        id: doc.id as string,
        userId: doc.userId as string,
        title: doc.title as string,
        notes: doc.notes as string | undefined,
        dueDate: doc.dueDate as string | null | undefined,
        completed: doc.completed as boolean,
        createdAt: doc.createdAt as string,
        updatedAt: doc.updatedAt as string,
      }));

      res.json(result);
    } catch (err) {
      console.error('list-todos error:', (err as Error).message);
      res.status(500).json({ error: 'Failed to fetch todos' });
    }
  });

  // ── POST /api/todos ──────────────────────────────────────────────────────
  // Creates a new todo for the authenticated user.
  router.post('/', async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = req.body as Partial<Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      res.status(400).json({ error: 'title is required and must be a non-empty string' });
      return;
    }

    if (typeof body.completed !== 'boolean') {
      res.status(400).json({ error: 'completed is required and must be a boolean' });
      return;
    }

    const now = new Date().toISOString();
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      userId,
      title: body.title.trim(),
      notes: body.notes ?? undefined,
      dueDate: body.dueDate ?? null,
      completed: body.completed,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await todos.insertOne({ ...newTodo });
      res.status(201).json(newTodo);
    } catch (err) {
      console.error('create-todo error:', (err as Error).message);
      res.status(500).json({ error: 'Failed to create todo' });
    }
  });

  // ── PATCH /api/todos/:id ─────────────────────────────────────────────────
  // Updates one or more fields of an existing todo owned by the user.
  router.patch('/:id', async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Todo id is required' });
      return;
    }

    const body = req.body as Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>;

    // Build the update object from only the allowed fields that were provided.
    const allowed: Array<keyof Omit<Todo, 'id' | 'userId' | 'createdAt'>> = [
      'title',
      'notes',
      'dueDate',
      'completed',
      'updatedAt',
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields provided for update' });
      return;
    }

    // Validate types for the fields that were supplied.
    if ('title' in updates && (typeof updates.title !== 'string' || (updates.title as string).trim() === '')) {
      res.status(400).json({ error: 'title must be a non-empty string' });
      return;
    }
    if ('completed' in updates && typeof updates.completed !== 'boolean') {
      res.status(400).json({ error: 'completed must be a boolean' });
      return;
    }

    // Always stamp updatedAt.
    updates.updatedAt = new Date().toISOString();

    try {
      const result = await todos.findOneAndUpdate(
        { id, userId },
        { $set: updates },
        { returnDocument: 'after' },
      );

      if (!result) {
        res.status(404).json({ error: 'Todo not found or does not belong to you' });
        return;
      }

      const updated: Todo = {
        id: result.id as string,
        userId: result.userId as string,
        title: result.title as string,
        notes: result.notes as string | undefined,
        dueDate: result.dueDate as string | null | undefined,
        completed: result.completed as boolean,
        createdAt: result.createdAt as string,
        updatedAt: result.updatedAt as string,
      };

      res.json(updated);
    } catch (err) {
      console.error('update-todo error:', (err as Error).message);
      res.status(500).json({ error: 'Failed to update todo' });
    }
  });

  // ── DELETE /api/todos/:id ────────────────────────────────────────────────
  // Permanently deletes a todo owned by the authenticated user.
  router.delete('/:id', async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Todo id is required' });
      return;
    }

    try {
      const result = await todos.deleteOne({ id, userId });

      if (result.deletedCount === 0) {
        res.status(404).json({ error: 'Todo not found or does not belong to you' });
        return;
      }

      res.status(204).send();
    } catch (err) {
      console.error('delete-todo error:', (err as Error).message);
      res.status(500).json({ error: 'Failed to delete todo' });
    }
  });

  return router;
}

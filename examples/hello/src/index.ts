import { createApp, op, s } from 'midleton';

const greet = op({
    input: s.object({ name: s.string() }),
    handler: (input) => ({ message: `Hello, ${input.name}!` }),
});

const getUser = op({
    input: s.object({ id: s.string() }),
    handler: (input) => ({ id: input.id, name: 'Taro' }),
});

const app = createApp()
    .expose(greet, { rest: 'POST /greet', mcp: 'greet' })
    .expose(getUser, { rest: 'GET /users/:id' });

Bun.serve({ port: 3000, fetch: app.fetch });
console.log('http://localhost:3000');

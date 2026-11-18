import { describe, expect, test } from 'bun:test';
import { createRouter } from '../src/router';

describe('router', () => {
    const router = createRouter<string>();
    router.add('GET /users/:id', 'user');
    router.add('GET /', 'root');

    test('matches a static path', () => {
        expect(router.match('GET', '/')?.value).toBe('root');
    });

    test('decodes percent-encoded parameters', () => {
        expect(router.match('GET', '/users/a%20b')?.params).toEqual({ id: 'a b' });
    });

    test('does not match a different method, length or empty parameter', () => {
        expect(router.match('POST', '/users/42')).toBeUndefined();
        expect(router.match('GET', '/users')).toBeUndefined();
        expect(router.match('GET', '/users/42/extra')).toBeUndefined();
        expect(router.match('GET', '/users/')).toBeUndefined();
    });

    test('does not throw on malformed percent-encoding', () => {
        expect(router.match('GET', '/users/%E0%A4%A')).toBeUndefined();
    });

    test('extracts path parameters', () => {
        expect(router.match('GET', '/users/42')).toEqual({ value: 'user', params: { id: '42' } });
    });

    test('rejects duplicate parameter names in one pattern', () => {
        expect(() => router.add('GET /customers/:id/projects/:id', 'x')).toThrow();
    });
});

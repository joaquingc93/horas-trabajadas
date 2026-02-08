import { routes } from './app.routes';

describe('App routes', () => {
  it('should expose the main tabs routes', () => {
    const paths = routes.map((route) => route.path);
    expect(paths).toContain('entry');
    expect(paths).toContain('history');
    expect(paths).toContain('settings');
  });
});

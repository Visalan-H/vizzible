// Actual implementation lives in useAuth.jsx (rolldown-vite's dependency
// scanner doesn't enable JSX parsing for plain .js files). This shim exists
// so `.js`-suffixed imports (e.g. main.jsx) keep working.
export { AuthProvider, useAuth } from './useAuth.jsx';

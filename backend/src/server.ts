import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`Resume screening API running at http://localhost:${env.port}`);
});

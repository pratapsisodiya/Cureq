import { server } from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CureQ server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
});

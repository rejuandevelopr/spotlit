// Loads .env.local then .env for scripts, and marks the process as a script so A2A calls
// run in process (no web server needed).
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
process.env.SPOTLIT_SCRIPT = "1";

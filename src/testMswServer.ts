import { setupServer } from "msw/node";
import { handlers } from "./testMswHandlers";

export const server = setupServer(...handlers);

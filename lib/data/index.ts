import { DATA_SOURCE } from "@/lib/config";
import { firebaseRepository } from "./firebase";
import { mockRepository } from "./mock";
import type { Repository } from "./repository";

export const repo: Repository = DATA_SOURCE === "firebase" ? firebaseRepository : mockRepository;
export { mockRepository };
export type { FilingInput, Repository, SearchInput, UploadKind } from "./repository";

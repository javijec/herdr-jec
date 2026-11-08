import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readChanges } from "../bridge/changes.mjs";

test("readChanges groups only same-common-directory worktrees and reports file deltas", async (t) => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "gentle-herdr-changes-")); t.after(() => rm(scratch, { recursive: true, force: true }));
  const repo = path.join(scratch, "repo"); await mkdir(repo); const git=(cwd,...args)=>execFileSync("git", args, { cwd, stdio:"ignore" });
  git(repo,"init","-q"); git(repo,"config","user.name","Tests"); git(repo,"config","user.email","tests@example.invalid");
  await writeFile(path.join(repo,"base.txt"),"before\n");git(repo,"add","base.txt");git(repo,"commit","-qm","base");
  await writeFile(path.join(repo,"base.txt"),"after\nextra\n"); await writeFile(path.join(repo,"new.txt"),"new\n");
  const result=await readChanges(repo);
  assert.deepEqual(result.roots[0].files.map(({path,status})=>({path,status})),[{path:"base.txt",status:" M"},{path:"new.txt",status:"??"}]);
  assert.equal(result.additions,3); assert.equal(result.deletions,1);
});

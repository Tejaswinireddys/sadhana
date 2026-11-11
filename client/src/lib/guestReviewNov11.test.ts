/**
 * Source + unit contracts for the November 11, 2026 first-time-guest review:
 * the /classes filter dead end, the /register → /start consolidation, the
 * /pathways ↔ /classes naming collision, and the sample teacher profiles.
 * The pure fallback math itself is tested in shared/classLibrary.test.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { aliasRouteTarget } from "./routeAliases";
import { libraryClassFilters } from "./classesApi";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("class library filters never dead-end", () => {
  const classes = read("client/src/pages/Classes.tsx");

  it("offers closest matches when a filter combination matches nothing", () => {
    assert.match(classes, /closestClassMatches/);
    assert.match(classes, /data-testid="class-library-closest"/);
    assert.match(classes, /data-testid="class-library-closest-note"/);
  });

  it("points at short guided practices from the fallback", () => {
    assert.match(classes, /data-testid="class-library-closest-guided"/);
    assert.match(classes, /href="\/guided"/);
  });

  it("filters Continue watching by the active facets instead of ignoring them", () => {
    assert.match(classes, /visibleResumable/);
    assert.match(classes, /filterClasses\(resumable, libraryClassFilters\(filters\)\)/);
  });

  it("maps the chips to the same filter shape the server applies", () => {
    assert.deepEqual(libraryClassFilters({ level: "beginner", duration: "under-15" }), {
      level: "beginner",
      focus: undefined,
      minMinutes: 0,
      maxMinutes: 14,
    });
    assert.deepEqual(libraryClassFilters({ focus: "back pain" }), { level: undefined, focus: ["back pain"] });
  });
});

describe("one onboarding path for new users", () => {
  it("redirects the retired /register wizard to the /start quiz", () => {
    assert.equal(aliasRouteTarget("/register"), "/start");
    const app = read("client/src/App.tsx");
    assert.equal(/path="\/register"/.test(app), false, "App must not mount a /register page over the alias");
    assert.equal(existsSync(resolve("client/src/pages/Register.tsx")), false, "the wizard page is retired");
  });

  it("keeps the server answering /register with the app shell (so the alias can run)", () => {
    assert.match(read("server/static.ts"), /"register"/);
  });

  it("labels the kept planning tools accurately", () => {
    const profiles = read("client/src/pages/Profiles.tsx");
    assert.match(profiles, /not an account signup/);
    assert.match(profiles, /data-testid="profiles-start-link"/);
    const settings = read("client/src/pages/Settings.tsx");
    assert.match(settings, /href="\/start" data-testid="settings-register"/);
  });
});

describe("Pathways and Classes are named apart", () => {
  it("heads /pathways as Pathways, not Classes", () => {
    const pathways = read("client/src/pages/Pathways.tsx");
    assert.match(pathways, /useDocumentTitle\("Pathways · Sadhana"\)/);
    assert.match(pathways, /<h1 className="font-serif text-3xl font-semibold tracking-tight">Pathways<\/h1>/);
    assert.match(pathways, /data-testid="pathways-classes-link"/, "cross-link to the video library");
  });

  it("keeps /classes as the video library", () => {
    const classes = read("client/src/pages/Classes.tsx");
    assert.match(classes, /useDocumentTitle\("Video classes · Sadhana"\)/);
    assert.match(classes, /<h1 className="font-serif text-3xl font-semibold tracking-tight">Video classes<\/h1>/);
  });
});

describe("sample teacher profiles are gated from the public", () => {
  const instructors = read("client/src/pages/Instructors.tsx");

  it("renders them only behind the explicit preview flag", () => {
    assert.match(instructors, /VITE_SHOW_SAMPLE_TEACHERS === "true"/);
    assert.match(instructors, /\{SHOW_SAMPLE_TEACHERS && \(/);
  });

  it("keeps the waitlist and a practice-today path for everyone", () => {
    assert.match(instructors, /data-testid="teachers-waitlist-join"/);
    assert.match(instructors, /data-testid="teachers-practice-today"/);
    assert.match(instructors, /href="\/adaptive"/);
  });

  it("keeps the sample data (it is gated, not deleted)", () => {
    assert.match(read("client/src/data/instructors.ts"), /INSTRUCTORS/);
    assert.match(instructors, /INSTRUCTORS\.map/);
  });
});

// Harness entry — mounts the Host component into #app.
//
// Kept tiny on purpose. Anything heavier (state, scenario routing,
// puppeteer surface) lives in Host.svelte / harness-store.svelte.ts.

import { mount } from "svelte";
import Host from "./Host.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("harness: missing #app root in harness.html");

mount(Host, { target });

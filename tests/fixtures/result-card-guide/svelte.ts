import { mount } from "svelte";
import SvelteApp from "./SvelteApp.svelte";

const target = document.querySelector<HTMLElement>("#result");
if (!target) throw new Error("Missing #result host element");

mount(SvelteApp, { target });

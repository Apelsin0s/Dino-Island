// Bundles three.js into one classic script so it works from file:// (Electron) without ES modules.
import * as THREE from 'three';
window.THREE = THREE;

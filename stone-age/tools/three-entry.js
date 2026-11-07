// Bundles three.js (plus the geometry-merging helper) into one classic script,
// so it works from file:// in Electron without ES modules.
import * as THREE_NS from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
window.THREE = Object.assign({}, THREE_NS, { mergeGeometries });

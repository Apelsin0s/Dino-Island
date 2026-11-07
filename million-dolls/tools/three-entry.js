// Bundles three.js plus the helpers we use into one classic script (works from file:// in Electron).
import * as THREE_NS from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
window.THREE = Object.assign({}, THREE_NS, { mergeGeometries });

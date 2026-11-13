// Bundled into src/vendor/three.min.js (npm run vendor): window.THREE plus the add-ons the game uses.
import * as THREE_NS from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const THREE = Object.assign({}, THREE_NS, { EffectComposer, RenderPass, UnrealBloomPass, GTAOPass, OutputPass, RoundedBoxGeometry, BufferGeometryUtils });
window.THREE = THREE;

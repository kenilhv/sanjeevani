// three's PCF filter takes 17 shadow-map samples per pixel, which is the largest cost of a frame on an integrated GPU.
// Nine keep the same soft edge in this flat pastel scene. Importing this module patches the chunk before any material compiles.
import * as THREE from 'three';

const NINE = `shadow = (
		texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
		texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
		texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
		texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
		texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z ) +
		texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
		texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
		texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
		texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z )
	) * ( 1.0 / 9.0 );`;

const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
const patched = chunk.replace(/shadow = \(\s*texture2DCompare\( shadowMap, shadowCoord\.xy \+ vec2\( dx0, dy0 \)[\s\S]*?\( 1\.0 \/ 17\.0 \);/, NINE);
if (patched === chunk) console.warn('shadow-filter: three changed its PCF chunk, patch not applied');
THREE.ShaderChunk.shadowmap_pars_fragment = patched;

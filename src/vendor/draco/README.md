# Draco 3D Data Compression

Draco is an open-source library for compressing and decompressing 3D geometric meshes and point clouds. It is intended to improve the storage and transmission of 3D graphics.

[Website](https://google.github.io/draco/) | [GitHub](https://github.com/google/draco)

## Contents

This folder contains the glTF decoder files distributed with Three.js r175:

* `draco_decoder.wasm` — WebAssembly decoder, compatible with newer browsers and devices.
* `draco_wasm_wrapper.js` — JavaScript wrapper for the WASM decoder.

Upstream provides two decoder variations:

* **Default:** Latest stable builds, tracking the project's [master branch](https://github.com/google/draco).
* **glTF:** Builds targeted by the [glTF mesh compression extension](https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression), tracking the [corresponding Draco branch](https://github.com/google/draco/tree/gltf_2.0_draco_extension).

Either variation may be used with `DRACOLoader`:

```js
var dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('path/to/decoders/');
dracoLoader.setDecoderConfig({type: 'wasm'});
```

Further [documentation on GitHub](https://github.com/google/draco/tree/master/javascript/example#static-loading-javascript-decoder).

## License

[Apache License 2.0](./LICENSE.txt)

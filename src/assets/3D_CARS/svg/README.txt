FOUR TOY-INSPIRED VEHICLES | PROCEDURAL ORIGINAL GEOMETRY

Models: eight_ball_racer, crocodile_monster_truck, cowboy_pickup, expedition_jeep
Each .glb is a self-contained glTF 2.0 file with PBR materials.
Each _gltf folder contains equivalent model.gltf and binary buffer(s). Keep them together.
Axes: Z up, -X front, right/left across Y. Roughly meter-scale but stylized.
The car bodies, accessories, wheels and display stands are actual triangle meshes.
These are independently made approximations from reference images, not scans or original game mesh exports.
Use the .glb directly with Three.js GLTFLoader or React Three Fiber useGLTF.
Mesh names encode part and material e.g. front_L__tire; hide display_base__platform for gameplay.
Separate wheel-part nodes use an explicit pivot at their axle center.
Avoid combining wheel subparts if you intend to animate them individually.
Each *_game.glb excludes the circular showcase pedestal and is recommended for gameplay.
Each original *.glb includes a separate editable pedestal for turntable display.
preview_collage.jpg and *_preview.png are renders of the actual procedural meshes.

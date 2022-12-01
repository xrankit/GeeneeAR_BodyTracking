
import { PoseRenderer, PoseOutfitPlugin, OutfitParams } from "@geenee/bodyrenderers-three";
import { PoseResult } from "@geenee/bodyprocessors";
import * as three from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";

// Renderer
export class AvatarRenderer extends PoseRenderer {
    // Scene
    protected plugin: PoseOutfitPlugin;
    protected model?: three.Group;
    protected light?: three.PointLight;
    protected ambient?: three.AmbientLight;
    readonly lightInt: number = 0.75;
    readonly ambientInt: number = 1.25;
    // Hands up
    protected handsUp = false;
    protected textModel?: three.Group;

    // Constructor
    constructor(
        container: HTMLElement,
        mode?: "fit" | "crop",
        mirror?: boolean,
        protected url = "onesie.glb",
        protected outfit?: OutfitParams) {
        super(container, mode, mirror);
        this.plugin = new PoseOutfitPlugin(undefined, outfit);
        this.addPlugin(this.plugin);
    }

    // Load assets and setup scene
    async load() {
        if (this.loaded || !this.scene)
            return;
        await this.setupScene(this.scene);
        return super.load();
    }

    // Setup scene
    protected async setupScene(scene: three.Scene) {
        // Model
        await this.setModel(this.url);
        // Lightning
        this.light = new three.PointLight(0xFFFFFF, this.lightInt);
        this.ambient = new three.AmbientLight(0xFFFFFF, this.ambientInt);
        scene.add(this.light);
        scene.add(this.ambient);
        // Environment
        const environment = await new RGBELoader().loadAsync("environment.hdr");
        environment.mapping = three.EquirectangularReflectionMapping;
        scene.environment = environment;
        // Text model
        const font = await new FontLoader().loadAsync("font.json");
        const geometry = new TextGeometry("HOORAY!!!", {
            font: font, size: 5, height: 2,
            bevelSize: 0.3, bevelThickness: 1,
            bevelSegments: 10, bevelEnabled: true
        });
        // Center model
        geometry.scale(0.01, 0.01, 0.01);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        if (box)
            geometry.translate(...box.max.sub(box.min).
                multiplyScalar(-0.5).toArray());
        geometry.rotateY(Math.PI);
        const mesh = new three.Mesh(geometry, [
            new three.MeshStandardMaterial({ color: 0x3BDB9B, flatShading: true }),
            new three.MeshStandardMaterial({ color: 0x3BDB9B })
        ]);
        this.textModel = new three.Group();
        this.textModel.visible = false;
        this.textModel.add(mesh);
        this.scene?.add(this.textModel);
    }

    // Set model to render
    async setModel(url: string) {
        return this.setOutfit(url, this.outfit);
    }

    // Set outfit to render
    async setOutfit(url: string, outfit?: OutfitParams) {
        if (this.model)
            this.disposeObject(this.model);
        delete this.model;
        this.url = url;
        this.outfit = outfit;
        const gltf = await new GLTFLoader().loadAsync(url);
        this.model = gltf.scene;
        this.scene?.add(this.model);
        this.plugin.setOutfit(this.model, outfit);
    }

    // Update
    async update(result: PoseResult, stream: HTMLCanvasElement) {
        // Analyze pose keypoints to detect hands up
        const { poses } = result;
        if (poses.length < 1) {
            this.handsUp = false;
            return super.update(result, stream);
        }
        // Keypoints
        const { points } = poses[0];
        const hipL = new three.Vector3(...points.hipL.metric);
        const hipR = new three.Vector3(...points.hipR.metric);
        const shoulderL = new three.Vector3(...points.shoulderL.metric);
        const shoulderR = new three.Vector3(...points.shoulderR.metric);
        const elbowL = new three.Vector3(...points.elbowL.metric);
        const elbowR = new three.Vector3(...points.elbowR.metric);
        const wristL = new three.Vector3(...points.wristL.metric);
        const wristR = new three.Vector3(...points.wristR.metric);
        // Arm vectors
        const torsoL = shoulderL.clone().sub(hipL).normalize();
        const torsoR = shoulderR.clone().sub(hipR).normalize();
        const armL = elbowL.clone().sub(shoulderL).normalize();
        const armR = elbowR.clone().sub(shoulderR).normalize();
        const foreArmL = wristL.clone().sub(elbowL).normalize();
        const foreArmR = wristR.clone().sub(elbowR).normalize();
        // Dot product of unit vectors gives cos of angle between
        // If vectors are parallel, angle is close to 0, cos to 1
        const armLCos = torsoL.dot(armL);
        const armRCos = torsoR.dot(armR);
        const foreArmLCos = foreArmL.dot(armL);
        const foreArmRCos = foreArmR.dot(armR);
        // Hands are up if all vectors have almost the same direction
        // Add hysteresis when changing mouth state to reduce noise
        const cosMin = Math.min(armLCos, armRCos, foreArmLCos, foreArmRCos);
        if (cosMin > 0.8)
            this.handsUp = true;
        if (cosMin < 0.7)
            this.handsUp = false;
        // Position text model
        const { textModel } = this;
        if (textModel) {
            const position = wristL.clone().lerp(wristR, 0.5);
            textModel.position.copy(position);
            textModel.visible = this.handsUp;
        }
        await super.update(result, stream);
    }
}

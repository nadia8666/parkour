import { Airship } from "@Easy/Core/Shared/Airship";
import { Binding } from "@Easy/Core/Shared/Input/Binding";

const ENV: { Runtime: "DEV" | "PROD"; DebugDrawing: boolean } = {
	Runtime: "DEV",
	DebugDrawing: false,
};

Airship.Input.CreateAction("Debug", Binding.Key(Key.P), { category: "DEBUG" });
Airship.Input.OnDown("Debug").Connect(() => (ENV.DebugDrawing = !ENV.DebugDrawing));

export default ENV;

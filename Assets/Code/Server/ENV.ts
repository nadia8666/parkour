import { Airship } from "@Easy/Core/Shared/Airship";
import { Game } from "@Easy/Core/Shared/Game";
import { Binding } from "@Easy/Core/Shared/Input/Binding";

const ENV: { Runtime: "DEV" | "PROD"; DebugDrawing: boolean; Shared: boolean } = {
	Runtime: "DEV",
	DebugDrawing: false,
	Shared: Game.IsHosting(),
};

Airship.Input.CreateAction("Debug", Binding.Key(Key.P), { category: "AP - Debug" });
Airship.Input.OnDown("Debug").Connect(() => (ENV.DebugDrawing = !ENV.DebugDrawing));

export default ENV;

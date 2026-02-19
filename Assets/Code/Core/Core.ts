import _CoreSingleton from "./CoreSingleton";

let Core: _CoreSingleton;
let CoreLoaded = false;
let FramesPassed = 0;
task.spawn(() => {
	Core = _CoreSingleton.Get();
});

task.spawn(() => {
	while (!Core) {}

	while (!Core.Client) {
		task.wait();
	}
	while (!Core.Client.Data) {
		task.wait();
	}
	while (!Core.Client.Gear) {
		task.wait();
	}
	while (!Core.Client.UI) {
		task.wait();
	}
	while (!Core.Client.Animation) {
		task.wait();
	}
	while (!Core.Client.Drag) {
		task.wait();
	}
	while (!Core.Client.Settings) {
		task.wait();
	}
	while (!Core.Client.Sound) {
		task.wait();
	}
	while (!Core.Client.Objective.TimeTrials) {
		task.wait();
	}
	while (!Core.Client.World) {
		task.wait();
	}
	while (!Core.Client.World.Ziplines) {
		task.wait();
	}
	while (!Core.Client.World.Ladders) {
		task.wait();
	}
	while (!Core.Client.WorldController) {
		task.wait();
	}

	while (!Core.Gear) {
		task.wait();
	}

	while (!Core.Server) {
		task.wait();
	}
	while (!Core.Server.DataService) {
		task.wait();
	}

	CoreLoaded = true;
});

export = () => {
	while (!CoreLoaded) {
		while (FramesPassed <= 10) {
			FramesPassed++;
			task.wait();
		}
	}
	return Core;
};

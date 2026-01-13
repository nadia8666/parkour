import _CoreSingleton from "./CoreSingleton";

let Core: _CoreSingleton;
task.spawn(() => (Core = _CoreSingleton.Get()));

export = () => {
	while (!Core) {}
	return Core;
};

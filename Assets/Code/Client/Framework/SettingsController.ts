import { Airship } from "@Easy/Core/Shared/Airship"

export const Settings = {
    HoldWallclimb: true,
    HoldWallrun: false,

    CameraSensitivityMouse: 0,
}

export default class SettingsController extends AirshipSingleton {
    @Client()
    override Start() {
        Airship.Settings.AddToggle("Hold to Wallclimb", Settings.HoldWallclimb)
        Airship.Settings.ObserveToggle("Hold to Wallclimb", (Value) => {
            Settings.HoldWallclimb = Value
        })

        Airship.Settings.AddToggle("Hold to Wallrun", Settings.HoldWallrun)
        Airship.Settings.ObserveToggle("Hold to Wallrun", (Value) => {
            Settings.HoldWallrun = Value
        })

        Airship.Settings.AddSlider("Mouse Camera Sens.", 1, 0, 3, .01)
        Airship.Settings.ObserveSlider("Mouse Camera Sens.", (Sens) => {
            Settings.CameraSensitivityMouse = Sens
        })
    }
}
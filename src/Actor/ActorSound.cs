using Godot;

namespace Parkour.Actor;

public partial class ActorSound : Node3D
{
    [Export] public AudioStreamPlayer3D footstep;
    
    [Export] public AudioStreamPlayer3D grab;
    
    [Export] public AudioStreamPlayer3D roll;

    [Export] public AudioStreamPlayer3D slideLoop;
    [Export] public AudioStreamPlayer3D slideStart;
}

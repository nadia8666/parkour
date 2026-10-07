using System;
using Godot;

namespace Parkour.Core;

public class PlayerManager : ISingleton
{
	private SceneContainer _sceneContainer;
	public PlayerManager(SceneContainer sceneContainer)
	{
		_sceneContainer = sceneContainer;
	}

	public Lazy<PackedScene> LocalPlayerModel = new(() => ResourceLoader.Load<PackedScene>("res://scenes/actor/local_player.tscn"));
	public Node3D SpawnPlayer(bool isLocalPlayer)
	{
		Node3D actor = isLocalPlayer switch
		{
			true => SpawnLocalPlayer(),
			_ => SpawnNetworkedPlayer()
		};

		return actor;
	}

	private Node3D SpawnLocalPlayer()
	{
		Node3D actor = (Node3D)LocalPlayerModel.Value.Instantiate();
		_sceneContainer.Scene.AddChild(actor);

		return actor;
	}

	private Node3D SpawnNetworkedPlayer()
	{
		GD.PushError("Unimplemented method.");
		return null;
	}
}

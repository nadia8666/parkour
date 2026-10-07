using Parkour.Core;

namespace Parkour;

public class Framework : ISingleton
{

    private readonly PlayerManager _playerManager;
    public Framework(PlayerManager playerManager)
    {
        _playerManager = playerManager;
    }

    public void Initialize()
    {
        // TEMPORARY
        _playerManager.SpawnPlayer(true);
    }
}

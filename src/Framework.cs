using Parkour.Core;

namespace Parkour;

public class Framework(PlayerManager playerManager) : ISingleton
{
    private readonly PlayerManager _playerManager = playerManager;

    public void Initialize()
    {
        // TEMPORARY
        _playerManager.SpawnPlayer(true);
    }
}

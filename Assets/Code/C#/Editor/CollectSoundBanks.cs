using Luau;
using Unity.VisualScripting;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

[CustomAirshipEditor("SoundController")]
public class SoundControllerEditor : AirshipEditor
{
    public override void OnInspectorGUI()
    {
        EditorGUILayout.LabelField("Definition Data");
        PropertyFields("SoundBanks", "SoundTemplate");

        if (GUILayout.Button("Populate Banks"))
        {
            GenerateBanks(serializedObject.FindAirshipProperty("SoundBanks"));
            serializedObject.ApplyModifiedProperties();
            Debug.Log("Populated sound banks!");
        }
    }

    [MenuItem("Parkour/Populate Sound Bank List")]
    private static void GenerateBanksMenu()
    {
        AirshipType soundController = AirshipType.GetType("SoundController");
        foreach (GameObject obj in SceneManager.GetActiveScene().GetRootGameObjects())
        {
            if (obj.name == "Singletons")
            {
                foreach (AirshipComponent component in obj.transform.Find("Controllers").GetComponents<AirshipComponent>())
                {
                    if (component.GetAirshipType() == soundController)
                    {
                        AirshipSerializedObject so = new AirshipSerializedObject(component);
                        GenerateBanks(so.FindAirshipProperty("SoundBanks"));
                        so.ApplyModifiedProperties();
                        Debug.Log("Populated sound banks!");
                    }
                }
            }
        }
    }

    public static void GenerateBanks(AirshipSerializedProperty property)
    {
        string[] guids = AssetDatabase.FindAssets("t:ScriptableObject", new[] { "Assets/Resources/Sounds/Banks" });
        int count = guids.Length;

        property.array.ClearArray();
        for (int i = 0; i < count; i++)
        {
            string path = AssetDatabase.GUIDToAssetPath(guids[i]);
            AirshipScriptableObject so = AssetDatabase.LoadAssetAtPath<AirshipScriptableObject>(path);

            AirshipSerializedArrayValue arrayVal = property.array.PushElement();
            arrayVal.objectReferenceValue = so;
        }
    }
}
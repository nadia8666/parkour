Shader "Unlit/VoxelWorldTransparentShader"
{
    Properties
    {
        _BaseMap ("Base Map", 2D) = "white" {}
    }
    SubShader
    {
        Tags 
        { 
            "RenderPipeline" = "UniversalPipeline"
            "RenderType" = "TransparentCutout" 
            "Queue" = "AlphaTest"
        }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            ZWrite On
            ZTest LEqual
            Cull Back

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 positionOS : TEXCOORD3;
                float3 normalWS   : TEXCOORD1;
                float3 normalOS   : TEXCOORD4;
            };

            TEXTURE2D(_BaseMap);
            SAMPLER(sampler_BaseMap);
            TEXTURE3D(_Lightmap);
            SAMPLER(sampler_Lightmap);

            float4 _GridCenter;
            float4 _GridSize;
            float _VerticalOffset;

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
            CBUFFER_END

            Varyings vert(Attributes input)
            {
                Varyings output;
                output.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                output.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                output.positionOS = input.positionOS.xyz;
                output.normalOS = input.normalOS;
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                return output;
            }

            float4 frag(Varyings input) : SV_Target
            {
                float3 triplanarPos = input.positionOS + _VerticalOffset;
                float3 localNormal = normalize(input.normalOS);
                float3 blend = abs(localNormal);
                blend /= (blend.x + blend.y + blend.z);

                float2 uvX = triplanarPos.zy * _BaseMap_ST.xy + _BaseMap_ST.zw;
                float2 uvY = triplanarPos.xz * _BaseMap_ST.xy + _BaseMap_ST.zw;
                float2 uvZ = triplanarPos.xy * _BaseMap_ST.xy + _BaseMap_ST.zw;

                float4 triplanar = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvX) * blend.x +
                                SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvY) * blend.y +
                                SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvZ) * blend.z;

                float3 normalWS = normalize(input.normalWS);
                float3 adjustedPos = input.positionWS + (normalWS * 0.5);
                float3 uvw = (adjustedPos - _GridCenter.xyz + (_GridSize.xyz/2)) / _GridSize.xyz;
                float light = SAMPLE_TEXTURE3D(_Lightmap, sampler_Lightmap, float3(uvw.x, floor(adjustedPos.y)/_GridSize.y, uvw.z)).r;

                clip(triplanar.a - 0.1);
                return float4(triplanar.rgb * light, triplanar.a);                  
            }
            ENDHLSL
        }

        // required for DOF? lol.
        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }

            ZWrite On
            Cull Back

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 normalWS : TEXCOORD0; };

            Varyings vert(Attributes input)
            {
                Varyings output;
                output.positionCS = TransformWorldToHClip(TransformObjectToWorld(input.positionOS.xyz));
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                return output;
            }

            float4 frag(Varyings input) : SV_Target
            {
                return float4(PackNormalOctRectEncode(normalize(input.normalWS)), 0.0, 1.0);
            }
            ENDHLSL
        }
    }
}
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
            "RenderType" = "Transparent" 
            "Queue" = "Transparent" 
        }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            ZWrite On
            ZTest LEqual
            Cull Back
            Blend SrcAlpha OneMinusSrcAlpha

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
                float3 normalWS   : TEXCOORD1;
            };

            TEXTURE2D(_BaseMap);
            SAMPLER(sampler_BaseMap);
            
            TEXTURE3D(_Lightmap);
            SAMPLER(sampler_Lightmap);
            float4 _GridCenter;
            float4 _GridSize;

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
            CBUFFER_END

            Varyings vert(Attributes input)
            {
                Varyings output;
                output.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                output.positionCS = TransformWorldToHClip(input.positionOS.xyz);
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                return output;
            }

            float4 frag(Varyings input) : SV_Target
            {
                float3 normal = normalize(input.normalWS);
                float3 blend = abs(normal);
                blend /= (blend.x + blend.y + blend.z);

                float2 uvX = input.positionWS.zy * _BaseMap_ST.xy + _BaseMap_ST.zw;
                float2 uvY = input.positionWS.xz * _BaseMap_ST.xy + _BaseMap_ST.zw;
                float2 uvZ = input.positionWS.xy * _BaseMap_ST.xy + _BaseMap_ST.zw;

                float4 colX = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvX);
                float4 colY = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvY);
                float4 colZ = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvZ);
                float4 triplanar = colX * blend.x + colY * blend.y + colZ * blend.z;

                float3 adjustedPos = input.positionWS + (normal * 0.1);
                float3 uvw = (adjustedPos - _GridCenter.xyz + (_GridSize.xyz/2)) / _GridSize.xyz;
                float light = SAMPLE_TEXTURE3D(_Lightmap, sampler_Lightmap, float3(uvw.x, floor(adjustedPos.y)/_GridSize.y, uvw.z)).r;
                //half ao = SampleAmbientOcclusion(GetNormalizedScreenSpaceUV(input.positionCS));

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
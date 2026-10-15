import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { lerConfig } from './src/armazenamento';
import TelaConfiguracao from './src/TelaConfiguracao';
import TelaPda from './src/TelaPda';
import { cores } from './src/estilo';

export default function App() {
  const [carregando, setCarregando] = useState(true);
  const [config, setConfig] = useState(null);
  const [configurando, setConfigurando] = useState(false);

  // Ao abrir: se o aparelho já foi configurado, vai direto para a tela do CPF
  useEffect(() => {
    lerConfig()
      .then((c) => setConfig(c))
      .finally(() => setCarregando(false));
  }, []);

  const pedirConfiguracao = useCallback(() => setConfigurando(true), []);

  if (carregando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: cores.fundo }}>
        <ActivityIndicator size="large" color={cores.vermelho} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      {!config || configurando ? (
        <TelaConfiguracao
          configAtual={config}
          aoConfigurar={(c) => { setConfig(c); setConfigurando(false); }}
          aoCancelar={() => setConfigurando(false)}
        />
      ) : (
        <TelaPda config={config} aoPedirConfiguracao={pedirConfiguracao} />
      )}
    </>
  );
}
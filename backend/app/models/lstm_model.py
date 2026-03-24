"""Modelo LSTM para predicción del precio del cacao."""

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler


class LSTMPredictor:
    """Predictor basado en LSTM (Long Short-Term Memory)."""

    def __init__(self, sequence_length: int = 60, units: int = 64, epochs: int = 50):
        self.sequence_length = sequence_length
        self.units = units
        self.epochs = epochs
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self._tf_imported = False

    def _import_tf(self):
        """Importación lazy de TensorFlow para evitar overhead en startup."""
        if not self._tf_imported:
            import tensorflow as tf

            tf.get_logger().setLevel("ERROR")
            self._tf = tf
            self._tf_imported = True

    def _build_model(self, input_shape: tuple):
        """Construye la arquitectura LSTM."""
        self._import_tf()
        tf = self._tf

        model = tf.keras.Sequential(
            [
                tf.keras.layers.LSTM(
                    self.units,
                    return_sequences=True,
                    input_shape=input_shape,
                ),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.LSTM(self.units // 2, return_sequences=False),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Dense(32, activation="relu"),
                tf.keras.layers.Dense(1),
            ]
        )
        model.compile(optimizer="adam", loss="mse", metrics=["mae"])
        return model

    def _create_sequences(self, data: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Crea secuencias para entrenamiento del LSTM."""
        X, y = [], []
        for i in range(self.sequence_length, len(data)):
            X.append(data[i - self.sequence_length : i])
            y.append(data[i, 0])  # Columna 0 = precio target
        return np.array(X), np.array(y)

    def fit(self, df: pd.DataFrame, target_col: str = "Close_Seco"):
        """Entrena el modelo LSTM.

        Args:
            df: DataFrame con features numéricas
            target_col: Columna objetivo
        """
        self._import_tf()

        # Seleccionar features numéricas
        feature_cols = [target_col] + [
            c
            for c in df.select_dtypes(include=[np.number]).columns
            if c != target_col and not c.endswith("_Baba")
        ]
        # Limitar features para evitar overfitting
        feature_cols = feature_cols[:20]

        data = df[feature_cols].values
        self.scaler.fit(data)
        scaled_data = self.scaler.transform(data)

        X, y = self._create_sequences(scaled_data)

        if len(X) == 0:
            raise ValueError("No hay suficientes datos para crear secuencias.")

        self.model = self._build_model((X.shape[1], X.shape[2]))
        self.model.fit(
            X,
            y,
            epochs=self.epochs,
            batch_size=32,
            validation_split=0.1,
            verbose=0,
        )

        self._feature_cols = feature_cols
        self._n_features = len(feature_cols)
        return self

    def predict(self, df: pd.DataFrame, horizon: int) -> list[float]:
        """Genera predicciones para el horizonte especificado."""
        if self.model is None:
            raise ValueError("El modelo no ha sido entrenado.")

        data = df[self._feature_cols].values
        scaled_data = self.scaler.transform(data)

        predictions = []
        current_seq = scaled_data[-self.sequence_length :].copy()

        for _ in range(horizon):
            input_seq = current_seq.reshape(1, self.sequence_length, self._n_features)
            pred_scaled = self.model.predict(input_seq, verbose=0)[0, 0]

            # Crear fila completa para inverse transform
            pred_row = current_seq[-1].copy()
            pred_row[0] = pred_scaled

            # Inverse transform para obtener precio real
            full_row = pred_row.reshape(1, -1)
            inv = self.scaler.inverse_transform(full_row)
            predictions.append(float(inv[0, 0]))

            # Actualizar secuencia
            current_seq = np.vstack([current_seq[1:], pred_row])

        return predictions

    def get_metrics(
        self, df: pd.DataFrame, target_col: str = "Close_Seco", test_size: int = 30
    ) -> dict:
        """Calcula métricas de rendimiento."""
        data = df[self._feature_cols].values
        scaled_data = self.scaler.transform(data)

        X, y_true = self._create_sequences(scaled_data)
        X_test = X[-test_size:]
        y_test_scaled = y_true[-test_size:]

        y_pred_scaled = self.model.predict(X_test, verbose=0).flatten()

        # Inverse transform
        dummy = np.zeros((len(y_test_scaled), self._n_features))
        dummy[:, 0] = y_test_scaled
        y_test_real = self.scaler.inverse_transform(dummy)[:, 0]

        dummy[:, 0] = y_pred_scaled
        y_pred_real = self.scaler.inverse_transform(dummy)[:, 0]

        mse = float(np.mean((y_test_real - y_pred_real) ** 2))
        rmse = float(np.sqrt(mse))
        mae = float(np.mean(np.abs(y_test_real - y_pred_real)))
        mape = float(
            np.mean(np.abs((y_test_real - y_pred_real) / y_test_real)) * 100
        )

        return {"mse": mse, "rmse": rmse, "mae": mae, "mape": mape}

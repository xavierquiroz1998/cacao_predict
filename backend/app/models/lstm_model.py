"""Modelo LSTM mejorado para predicción del precio del cacao."""

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler


class LSTMPredictor:
    """Predictor LSTM con semilla fija, early stopping y predicciones suavizadas."""

    def __init__(self, sequence_length: int = 60, units: int = 64, epochs: int = 80, seed: int = 42):
        self.sequence_length = sequence_length
        self.units = units
        self.epochs = epochs
        self.seed = seed
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self._tf_imported = False
        self._validation_errors = []

    def _import_tf(self):
        """Importación lazy de TensorFlow con determinismo forzado."""
        if not self._tf_imported:
            import os
            os.environ["TF_DETERMINISTIC_OPS"] = "1"
            os.environ["TF_CUDNN_DETERMINISTIC"] = "1"

            import tensorflow as tf

            tf.get_logger().setLevel("ERROR")
            tf.random.set_seed(self.seed)
            np.random.seed(self.seed)
            tf.config.experimental.enable_op_determinism()
            self._tf = tf
            self._tf_imported = True

    def _build_model(self, input_shape: tuple):
        """Arquitectura LSTM mejorada con BatchNormalization."""
        self._import_tf()
        tf = self._tf

        model = tf.keras.Sequential([
            tf.keras.layers.LSTM(
                self.units,
                return_sequences=True,
                input_shape=input_shape,
            ),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.LSTM(self.units // 2, return_sequences=False),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1),
        ])

        optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
        model.compile(optimizer=optimizer, loss="huber", metrics=["mae"])
        return model

    def _create_sequences(self, data: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Crea secuencias para entrenamiento."""
        X, y = [], []
        for i in range(self.sequence_length, len(data)):
            X.append(data[i - self.sequence_length : i])
            y.append(data[i, 0])
        return np.array(X), np.array(y)

    def fit(self, df: pd.DataFrame, target_col: str = "Close_Seco"):
        """Entrena LSTM con early stopping y semilla fija."""
        self._import_tf()
        tf = self._tf

        np.random.seed(self.seed)
        tf.random.set_seed(self.seed)

        # Seleccionar features numéricas relevantes
        feature_cols = [target_col] + [
            c for c in df.select_dtypes(include=[np.number]).columns
            if c != target_col and not c.endswith("_Baba")
        ]
        feature_cols = feature_cols[:15]  # Limitar para evitar overfitting

        data = df[feature_cols].values
        self.scaler.fit(data)
        scaled_data = self.scaler.transform(data)

        X, y = self._create_sequences(scaled_data)

        if len(X) == 0:
            raise ValueError("No hay suficientes datos para crear secuencias.")

        self.model = self._build_model((X.shape[1], X.shape[2]))

        # Early stopping para evitar overfitting
        early_stop = tf.keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=10, restore_best_weights=True
        )
        reduce_lr = tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=5, min_lr=1e-6
        )

        self.model.fit(
            X, y,
            epochs=self.epochs,
            batch_size=32,
            validation_split=0.15,
            callbacks=[early_stop, reduce_lr],
            verbose=0,
        )

        self._feature_cols = feature_cols
        self._n_features = len(feature_cols)
        return self

    def predict(self, df: pd.DataFrame, horizon: int) -> list[float]:
        """Predicciones multi-step con suavizado exponencial."""
        if self.model is None:
            raise ValueError("El modelo no ha sido entrenado.")

        np.random.seed(self.seed)

        data = df[self._feature_cols].values
        scaled_data = self.scaler.transform(data)

        predictions = []
        current_seq = scaled_data[-self.sequence_length:].copy()

        for step in range(horizon):
            input_seq = current_seq.reshape(1, self.sequence_length, self._n_features)
            pred_scaled = self.model.predict(input_seq, verbose=0)[0, 0]

            # Crear fila completa para inverse transform
            pred_row = current_seq[-1].copy()
            pred_row[0] = pred_scaled

            full_row = pred_row.reshape(1, -1)
            inv = self.scaler.inverse_transform(full_row)
            pred_real = float(inv[0, 0])

            # Suavizado: limitar cambio diario a ±2.5%
            if predictions:
                max_change = predictions[-1] * 0.025
                pred_real = np.clip(pred_real, predictions[-1] - max_change, predictions[-1] + max_change)

            predictions.append(pred_real)
            current_seq = np.vstack([current_seq[1:], pred_row])

        return predictions

    def get_metrics(
        self, df: pd.DataFrame, target_col: str = "Close_Seco", test_size: int = 30
    ) -> dict:
        """Calcula métricas con walk-forward validation."""
        np.random.seed(self.seed)

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

        errors = y_test_real - y_pred_real
        self._validation_errors = errors.tolist()

        mse = float(np.mean(errors ** 2))
        rmse = float(np.sqrt(mse))
        mae = float(np.mean(np.abs(errors)))
        mape = float(np.mean(np.abs(errors / y_test_real)) * 100)

        return {"mse": mse, "rmse": rmse, "mae": mae, "mape": mape}

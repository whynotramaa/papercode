"""
papercode — Linear Regression from scratch (Python implementation).

This program implements linear regression with:
  - Mean squared error loss
  - Gradient descent with momentum
  - Exponential learning rate scheduling
  - L2 regularisation (Ridge, optional)
  - Early stopping with patience
  - Gradient clipping
  - Internal feature normalisation (z-score)

Usage:
    python main.py
"""

import numpy as np

# =========================================================================
#  1. Loss function  –  Mean squared error
# =========================================================================
def mean_squared_error(y_true, y_pred):
    return np.mean((y_true - y_pred) ** 2)


# =========================================================================
#  2. LinearRegression class
# =========================================================================
class LinearRegression:
    def __init__(self,
                 learning_rate=0.01,
                 n_iterations=1000,
                 lambda_reg=0.0,
                 momentum=0.9,
                 lr_decay=0.99,
                 tol=1e-4,
                 patience=5,
                 clip_norm=1.0,
                 normalise=True,
                 verbose=False,
                 print_every=100,
                 random_seed=42):

        self.learning_rate = learning_rate
        self.n_iterations = n_iterations
        self.lambda_reg = lambda_reg
        self.momentum = momentum
        self.lr_decay = lr_decay
        self.tol = tol
        self.patience = patience
        self.clip_norm = clip_norm
        self.normalise = normalise
        self.verbose = verbose
        self.print_every = print_every
        self.random_seed = random_seed

        # Learned parameters
        self.weights = None
        self.bias = 0.0

        # Velocity buffers (momentum)
        self._vel_w = None
        self._vel_b = 0.0

        # Normalisation stats
        self._X_mean = None
        self._X_std = None

        # Training record
        self.loss_history = []
        self.n_iter_done = 0
        self.lr_final = 0.0

    # -------------------------------------------------------------------
    #  Fit
    # -------------------------------------------------------------------
    def fit(self, X, y):
        n_samples, n_features = X.shape

        # ---- 1. Normalise features ------------------------------------
        if self.normalise:
            self._X_mean = X.mean(axis=0)
            self._X_std  = X.std(axis=0, ddof=0)   # population std
            self._X_std[self._X_std < 1e-12] = 1e-12
            X_norm = (X - self._X_mean) / self._X_std
        else:
            self._X_mean = np.zeros(n_features)
            self._X_std  = np.ones(n_features)
            X_norm = X.copy()

        # ---- 2. Initialise parameters ---------------------------------
        rng = np.random.default_rng(self.random_seed)
        self.weights = rng.normal(0.0, 1.0 / np.sqrt(n_features), size=n_features)
        self.bias = 0.0
        self._vel_w = np.zeros(n_features)
        self._vel_b = 0.0
        self.loss_history = []

        best_loss = float('inf')
        patience_counter = 0
        lr_current = self.learning_rate

        # ---- 3. Training loop -----------------------------------------
        for iteration in range(self.n_iterations):
            # Forward pass
            y_pred = X_norm @ self.weights + self.bias

            # Error
            error = y_pred - y

            # Loss (MSE)
            loss = mean_squared_error(y, y_pred)

            # L2 regularisation
            if self.lambda_reg > 0.0:
                loss += (self.lambda_reg / (2.0 * n_samples)) * np.sum(self.weights ** 2)

            self.loss_history.append(loss)

            # ----- Early stopping ---------------------------------------
            if iteration > 0:
                if loss < best_loss - self.tol:
                    best_loss = loss
                    patience_counter = 0
                else:
                    patience_counter += 1
                if patience_counter >= self.patience:
                    self.n_iter_done = iteration + 1
                    if self.verbose:
                        print(f"  Early stopping at iteration {iteration + 1}")
                    break
            else:
                best_loss = loss

            # ----- Gradients -------------------------------------------
            dw = (1.0 / n_samples) * (X_norm.T @ error)
            db = np.mean(error)

            # L2 gradient contribution
            if self.lambda_reg > 0.0:
                dw += (self.lambda_reg / n_samples) * self.weights

            # ----- Gradient clipping ------------------------------------
            if self.clip_norm > 0.0:
                g_norm = np.linalg.norm(dw)
                if g_norm > self.clip_norm:
                    scale = self.clip_norm / g_norm
                    dw *= scale
                    db  *= scale

            # ----- Momentum update --------------------------------------
            self._vel_w = self.momentum * self._vel_w - lr_current * dw
            self.weights += self._vel_w

            self._vel_b = self.momentum * self._vel_b - lr_current * db
            self.bias += self._vel_b

            # ----- Learning rate decay ----------------------------------
            lr_current *= self.lr_decay

            # ----- Verbose ---------------------------------------------
            if self.verbose and (iteration + 1) % self.print_every == 0:
                print(f"  Iter {iteration + 1:3d} | loss {loss:.6f} | lr {lr_current:.6f}")

        self.n_iter_done = min(self.n_iter_done if self.n_iter_done else self.n_iterations,
                               self.n_iterations)
        self.lr_final = lr_current

        # ---- Denormalise weights for prediction on raw data -----------
        if self.normalise:
            w_denorm = np.where(self._X_std > 1e-12,
                                self.weights / self._X_std,
                                0.0)
            b_denorm = self.bias - np.sum(w_denorm * self._X_mean)
            self.weights = w_denorm
            self.bias = b_denorm

    # -------------------------------------------------------------------
    #  Predict
    # -------------------------------------------------------------------
    def predict(self, X):
        return X @ self.weights + self.bias

    # -------------------------------------------------------------------
    #  Score  (R²)
    # -------------------------------------------------------------------
    def score(self, X, y):
        y_pred = self.predict(X)
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - y.mean()) ** 2)
        return 1.0 - ss_res / ss_tot


# =========================================================================
#  3. Demo
# =========================================================================
def generate_synthetic_data(n_samples=1000, n_features=5, noise_std=0.5, seed=123):
    rng = np.random.default_rng(seed)
    X = rng.normal(size=(n_samples, n_features))
    true_weights = rng.normal(0.0, 2.0, size=n_features)
    y = X @ true_weights + rng.normal(0.0, noise_std, size=n_samples)
    return X, y, true_weights


def main():
    print("=== Linear Regression Demo (Python) ===\n")

    # ---- Generate data ------------------------------------------------
    X, y, true_weights = generate_synthetic_data(
        n_samples=1000, n_features=5, noise_std=0.5, seed=123
    )

    # ---- Train / test split -------------------------------------------
    train_size = int(0.8 * len(X))
    X_train, X_test = X[:train_size], X[train_size:]
    y_train, y_test = y[:train_size], y[train_size:]

    # ---- Train model --------------------------------------------------
    model = LinearRegression(
        learning_rate=0.1,
        n_iterations=500,
        lambda_reg=0.001,
        momentum=0.9,
        lr_decay=0.995,
        tol=1e-5,
        patience=10,
        clip_norm=1.0,
        normalise=True,
        verbose=True,
        print_every=50,
    )

    import time
    start = time.perf_counter()
    model.fit(X_train, y_train)
    elapsed = time.perf_counter() - start

    print(f"\n  Training time: {elapsed:.3f} s")
    print(f"  Iterations done: {model.n_iter_done}  (of {model.n_iterations})")
    print(f"  Final learning rate: {model.lr_final:.6f}")

    # ---- Evaluate -----------------------------------------------------
    train_loss = mean_squared_error(y_train, model.predict(X_train))
    test_loss  = mean_squared_error(y_test,  model.predict(X_test))
    r2 = model.score(X_test, y_test)

    print(f"  Train MSE: {train_loss:.6f}")
    print(f"  Test  MSE: {test_loss:.6f}")
    print(f"  Test  R²:  {r2:.4f}")

    # ---- Compare true vs learned weights ------------------------------
    print("\n  Learned weights (denormalised):")
    for j in range(len(true_weights)):
        print(f"    w[{j}] = {model.weights[j]:8.4f}  (true = {true_weights[j]:8.4f})")
    print(f"    bias = {model.bias:8.4f}")


if __name__ == "__main__":
    main()

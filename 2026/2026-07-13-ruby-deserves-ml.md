# Ruby Finally Gets a Real Machine Learning Framework

For over a decade, Ruby developers who wanted to do anything with numerical
computing or machine learning faced the same choice: switch to Python, or
cobble together half-maintained gems that wrapped NumPy at arm's length.
Neither option was great. The first meant abandoning a language you love. The
second meant living with sparse documentation, broken builds, and APIs that
felt foreign in Ruby.

I finally sat down and ported [MLX](https://github.com/ml-explore/mlx) --
Apple's array framework designed for machine learning on Apple silicon -- to
Ruby. The result is
[mlx-ruby](https://github.com/skryl/mlx-ruby): a native C++ extension that
gives Ruby lazy-evaluated arrays, automatic differentiation, a full neural
network library, and GPU acceleration. Not a wrapper around Python. Not a
transpiler. A direct binding to the MLX C++ runtime, with a Ruby API designed
to feel like Ruby.

## The Gap

Python dominates ML for well-known reasons: NumPy shipped early, SciPy built
on it, and then PyTorch and TensorFlow cemented the ecosystem. But Python
didn't win because of its syntax. It won because the libraries existed.

Ruby, meanwhile, has had scattered attempts. NMatrix came and went. Numo::NArray
works for basic numerics but has no autodiff, no GPU support, no neural network
abstractions. Torch.rb wraps LibTorch through FFI, which is viable but means
inheriting PyTorch's design decisions wholesale -- a C++ API shaped by Python
conventions, adapted back into Ruby through a foreign function interface. Every
layer of indirection costs you something in ergonomics.

The core problem was never that Ruby couldn't do math. It's that nobody built
the full stack: arrays, differentiation, compilation, neural network modules,
optimizers, and serialization -- all designed together, with Ruby's strengths in
mind.

## Why Ruby Is Actually Good at This

Ruby gets dismissed for ML work as "too slow" or "not serious enough." But the
actual model-definition work in any ML framework isn't about raw loop speed --
it's about expressing architecture. You're composing layers, defining forward
passes, specifying loss functions. The heavy computation happens in C++/Metal/CUDA
kernels regardless of which language you write your model definition in.

And for the *expressive* part -- the part where you actually design things --
Ruby is exceptional. Consider what a trainable model looks like:

```ruby
class LinearRegressor < MLX::NN::Module
  def initialize
    super()
    self.linear = MLX::NN::Linear.new(3, 1)
  end

  def call(x)
    linear.call(x)
  end
end
```

That's it. No decorators. No type annotations fighting the runtime. No
`__init__` / `super().__init__()` ceremony. Ruby's `self.name = value`
pattern registers parameters automatically for tracking and optimization.
The module base class handles the rest.

Ruby's blocks make functional transforms read naturally:

```ruby
loss_fn = ->(w) do
  mx.mean(mx.square(mx.matmul(x_train, w) - y)) * 0.5
end

grad_fn = mx.grad(loss_fn)
```

A training loop is just a loop:

```ruby
200.times do
  grad = grad_fn.call(w)
  w = w - grad * lr
  mx.eval(w)
end
```

No session management, no tape context, no `with torch.no_grad():`. MLX's lazy
evaluation model means you build a computation graph implicitly and materialize
it when you call `mx.eval`. Ruby's clean syntax makes this feel invisible.

## Why MLX

I chose MLX as the foundation for a few reasons.

**Clean C++ core.** MLX was designed from scratch by Apple's ML research team.
The C++ API is modern (C++20), well-factored, and doesn't carry decades of
backward-compatibility debt. Binding to it directly is tractable -- the native
extension is about 8,000 lines of C++, which is manageable for one person.

**Lazy evaluation.** MLX arrays aren't computed until you need them. This means
you can build arbitrarily large computation graphs without materializing
intermediate results. It also makes automatic differentiation natural -- the
graph is already there.

**Unified memory.** On Apple silicon, MLX operates on unified CPU/GPU memory.
No explicit transfers, no `tensor.to("cuda")`. You write your code and it runs
where it should. On Linux, the CPU backend works the same way.

**Composable transforms.** MLX treats `grad`, `vmap`, `jvp`, `vjp`, and
`compile` as function transforms -- higher-order functions that take a function
and return a new function. This maps perfectly to Ruby's lambda/proc model.

## Metal, Unified Memory, and the GPU

The performance story of mlx-ruby is really the performance story of MLX
itself -- and that story starts with Apple silicon's unified memory
architecture.

### No More `tensor.to("cuda")`

In PyTorch, moving data between CPU and GPU is explicit and error-prone. You
allocate a tensor, call `.to("cuda")` to copy it to the GPU, do your work,
then copy results back. Forget a transfer and you get a cryptic device mismatch
error. On Apple silicon, MLX doesn't need any of this -- CPU and GPU share the
same physical memory. An array created on one device is immediately accessible
to the other:

```ruby
a = mx.random_uniform([1024, 1024])

# Same data, no copies
mx.stream(mx.cpu) { mx.add(a, a) }   # runs on CPU
mx.stream(mx.gpu) { mx.add(a, a) }   # runs on GPU
```

There's no serialization, no PCIe bottleneck, no `cudaMemcpy`. The array
lives in unified memory and both processors see it directly. MLX handles
cross-device dependencies automatically -- if a GPU operation depends on a
CPU result, MLX ensures the CPU work finishes first without you writing
synchronization code.

### Device Selection

Picking where your code runs is straightforward:

```ruby
# Environment variable
# MLX_DEFAULT_DEVICE=gpu ruby train.rb

# Or in code
mx.set_default_device(mx.gpu)

# Or scope it to a block
mx.stream(mx.gpu) do
  result = mx.matmul(a, b)  # runs on GPU
end
# back to default device here
```

You can query what's available at runtime:

```ruby
mx.metal_is_available  # => true on Apple silicon
mx.device_info(mx.gpu) # => {"name" => "Apple M1 Max", ...}
```

### Mixed CPU/GPU Execution

Because there's no transfer cost, you can mix devices within a single
computation and actually gain performance. Put compute-heavy operations on the
GPU and small operations on the CPU, and they overlap:

```ruby
def mixed_compute(a, b)
  x = mx.stream(mx.gpu) { mx.matmul(a, b) }  # GPU: big matmul
  20.times do
    b = mx.stream(mx.cpu) { mx.exp(b) }       # CPU: small element-wise
  end
  [x, b]
end
```

On an M1 Max, this mixed approach runs in about 1.4ms compared to 2.8ms for
GPU-only execution -- a 2x speedup from letting both processors work
simultaneously. MLX's lazy evaluation and automatic dependency tracking make
this safe without manual synchronization.

### Lazy Evaluation and Async Execution

Nothing computes until you say so. This isn't just an implementation detail --
it's a performance strategy. You build an arbitrarily large computation graph,
and MLX optimizes and executes it as a unit:

```ruby
# None of this allocates or computes anything yet
x = mx.random_uniform([1000, 1000])
y = mx.matmul(x, x)
z = mx.sum(mx.exp(y))

# Now it all runs, fused and optimized
mx.eval(z)
```

For training loops where you don't need to block on every step, there's async
evaluation:

```ruby
mx.async_eval(model.parameters)  # returns immediately
# Ruby continues while Metal churns in the background
```

Critically, both `eval` and `async_eval` release Ruby's Global VM Lock (GVL)
during computation. This means other Ruby threads -- serving HTTP requests,
processing IO, running background jobs -- continue unblocked while the GPU
works. Your ML pipeline doesn't freeze your application.

### Custom Metal Kernels

When the built-in operations aren't enough, you can write custom Metal
shaders and call them directly from Ruby:

```ruby
source = <<~METAL
  uint elem = thread_position_in_grid.x;
  T tmp = inp[elem];
  out[elem] = metal::exp(tmp);
METAL

kernel = mx.metal_kernel("myexp", ["inp"], ["out"], source)

outputs = kernel.call(
  inputs: [x],
  output_shapes: [[4]],
  output_dtypes: [mx.float32],
  grid: [4, 1, 1],
  threadgroup: [4, 1, 1],
  template: [["T", mx.float32]]
)
```

This is the same API that the upstream MLX project uses for fused kernels.
The performance gains are real -- a custom grid-sample kernel on an M1 Max runs
**8.3x faster** on the forward pass and **40.5x faster** on the backward pass
compared to the equivalent composition of standard MLX primitives. Having this
escape hatch available from Ruby means you're never stuck at a performance
ceiling.

### JIT Compilation

For pure-Ruby function graphs, `mx.compile` JIT-compiles the computation:

```ruby
def expensive(x, y)
  mx.exp(mx.negative(x)) + y
end

fast = mx.compile(method(:expensive))

# First call compiles, subsequent calls use the cached version
fast.call(x, y)
```

The compiled function recompiles only when input shapes, types, or count
change. For inner-loop operations that get called thousands of times with the
same shapes, this eliminates graph-construction overhead entirely.

### Profiling with Xcode

On macOS, you can capture GPU traces and open them directly in Xcode's Metal
debugger:

```ruby
mx.metal_start_capture("trace.gputrace")
100.times { mx.eval(mx.matmul(a, b)) }
mx.metal_stop_capture
```

This gives you the full Metal debugging experience: dependency graphs,
per-kernel timing, memory bandwidth analysis, and occupancy metrics. You're
getting the same profiling workflow that game developers and Apple's own ML team
use -- from Ruby.

## What's in the Box

mlx-ruby ships as a gem (`gem install mlx`) with a native C++ extension that
compiles against the upstream MLX runtime. Here's what you get:

### Core Array Operations

Everything you'd expect from a NumPy-like library: creation (`zeros`, `ones`,
`arange`, `eye`), arithmetic, comparisons, reductions (`sum`, `mean`, `max`),
reshaping, slicing, concatenation, linear algebra (`matmul`, `transpose`),
trigonometric and transcendental functions, FFT, einsum, and more.

```ruby
mx = MLX::Core
x = mx.array([1.0, 2.0, 3.0], mx.float32)
y = mx.sqrt(x + 1.0)
mx.eval(y)
p y.to_a  # => [1.414..., 1.732..., 2.0]
```

### Function Transforms

Automatic differentiation, vectorized mapping, JIT compilation, and
checkpointing -- all as composable function transforms:

```ruby
grad_fn    = mx.grad(loss_fn)
mapped_fn  = mx.vmap(fn, in_axes: 0)
compiled   = mx.compile(fn)
loss, grad = mx.value_and_grad(fn).call(params)
```

### Neural Network Modules

Over 30 layer types organized under `MLX::NN`:

- **Linear layers:** `Linear`, `Bilinear`, `Identity`
- **Convolutions:** `Conv1d`, `Conv2d`, `Conv3d` and their transposed variants
- **Recurrent:** `RNN`, `GRU`, `LSTM`
- **Normalization:** `LayerNorm`, `RMSNorm`, `GroupNorm`, `BatchNorm`, `InstanceNorm`
- **Attention:** `MultiHeadAttention`, `TransformerEncoderLayer`
- **Pooling:** `MaxPool1d/2d`, `AvgPool1d/2d`, `AdaptiveAvgPool1d/2d`
- **Activations:** `ReLU`, `GELU`, `SiLU`, `Mish`, `Sigmoid`, `Tanh`, and more
- **Positional encoding:** `RoPE`, `ALiBi`
- **Embedding:** `Embedding`, `QuantizedEmbedding`
- **Quantization:** `QuantizedLinear`, `QQLinear`

### Optimizers and Schedulers

Eleven optimizers (`SGD`, `Adam`, `AdamW`, `RMSprop`, `Adagrad`, `AdaDelta`,
`Adamax`, `Lion`, `Adafactor`, `Muon`, and more) with learning rate schedulers
(exponential decay, cosine decay, step decay, linear schedules, joined
schedules).

### Loss Functions

`cross_entropy`, `binary_cross_entropy`, `l1_loss`, `mse_loss`,
`smooth_l1_loss`, `kl_div_loss` -- all with configurable reduction.

### Serialization

Load and save models in NPZ and SafeTensors formats. Weight loading with
strict mode for catching mismatches:

```ruby
model.save_weights("model.safetensors")
model.load_weights("model.safetensors", strict: true)
```

## A Real Example: Nano GPT in Ruby

Here's a Karpathy-style GPT defined in Ruby. This isn't pseudocode -- it runs:

```ruby
class NanoGpt < MLX::NN::Module
  def initialize(vocab_size:, seq_len:, dims:, heads:, layers:)
    super()
    self.token_embedding = MLX::NN::Embedding.new(vocab_size, dims)
    self.pos_embedding   = MLX::NN::Embedding.new(seq_len, dims)
    self.blocks = Array.new(layers) do
      MLX::NN::TransformerEncoderLayer.new(
        dims, heads,
        mlp_dims: dims * 4,
        dropout: 0.0,
        norm_first: true
      )
    end
    self.norm = MLX::NN::LayerNorm.new(dims)
    self.head = MLX::NN::Linear.new(dims, vocab_size)
    @causal_mask = MLX::NN::MultiHeadAttention
                     .create_additive_causal_mask(seq_len)
  end

  def call(input_ids)
    positions = mx.arange(0, input_ids.shape[1], 1, mx.int32)
    hidden = mx.add(
      token_embedding.call(input_ids),
      pos_embedding.call(positions)
    )
    blocks.each { |block| hidden = block.call(hidden, @causal_mask) }
    head.call(norm.call(hidden))
  end
end
```

Training it:

```ruby
model     = NanoGpt.new(vocab_size: 65, seq_len: 32,
                        dims: 128, heads: 4, layers: 2)
optimizer = MLX::Optimizers::AdamW.new(learning_rate: 1e-3)

loss_and_grad = MLX::NN.value_and_grad(
  model,
  lambda do |ids, labels|
    logits = model.call(ids)
    logits2d = mx.reshape(logits, [batch_size * seq_len, vocab_size])
    labels1d = mx.reshape(labels, [batch_size * seq_len])
    MLX::NN.cross_entropy(logits2d, labels1d, reduction: "mean")
  end
)

loss, grads = loss_and_grad.call(input_ids, target_ids)
optimizer.update(model, grads)
mx.eval(loss, model.parameters, optimizer.state)
```

Read that code and tell me Ruby isn't a natural fit for this kind of work. The
model definition is a class. The forward pass is a method. The training loop
uses standard Ruby iteration. Parameters are tracked automatically.
Gradients flow through lambdas.

## How It Works Under the Hood

The binding is a native Ruby C++ extension -- not FFI, not a subprocess calling
Python, not a SWIG-generated wrapper. The `ext/mlx/native.cpp` file (about
8,000 lines) directly wraps MLX's C++ types (`mx::array`, `mx::Device`,
`mx::Dtype`, `mx::Stream`) into Ruby objects with proper garbage collection
integration.

Ruby objects hold pointers to MLX C++ objects through `rb_data_type_t`
structures with custom free and mark functions. Symbol IDs are cached for
performance. The GIL is managed to allow MLX's background computation to
proceed while Ruby code continues.

On top of this C++ layer, the pure Ruby code in `lib/mlx/` provides the
higher-level API: the `MLX::NN::Module` base class with automatic parameter
tracking, the optimizer implementations, the loss functions, tree utility
functions for nested parameter structures, and distributed training helpers.

The build uses CMake to compile the upstream MLX library as part of the gem
installation. You need CMake >= 3.25 and a C++20 compiler, but beyond that
it's `gem install mlx` -- the extension builds itself.

## Where It Stands

This is a v1.0 release. The parity test suite runs 300+ tests comparing Ruby
output against the upstream Python MLX implementation. Benchmarks cover
transformers, CNNs, MLPs, RNNs, and a full Karpathy GPT-2 training loop --
all runnable against both Ruby and Python to verify there's no meaningful
performance gap from the language binding:

```bash
DEVICE=gpu ITERATIONS=50 bundle exec rake benchmark:transformer
```

It runs on macOS (with full Metal GPU acceleration on Apple silicon) and Linux
(CPU, with BLAS/LAPACK acceleration). Ruby >= 3.1 is required.

The performance you get is MLX's performance. The Ruby binding adds negligible
overhead because the actual computation -- matmuls, convolutions, attention,
gradient accumulation -- all happens in MLX's C++ and Metal kernels. Ruby
orchestrates; Metal executes. The Llama inference example demonstrates this
clearly: 7B parameters, ~39ms per token on an M1 Ultra, with prompt processing
in under 600ms. Those numbers are the same whether you're calling from Python
or Ruby, because the same Metal shaders are doing the work.

The benchmark harness makes this easy to verify yourself. Configure batch size,
sequence length, model dimensions, number of heads and layers, choose your
device, and compare Ruby against Python side by side:

```bash
DEVICE=gpu BATCH=8 SEQUENCE_LENGTH=128 DIMENSIONS=256 \
  HEADS=8 LAYERS=4 bundle exec rake benchmark:transformer
```

What's there today is enough to define, train, and run inference on real
models -- on the GPU, with the same performance as the Python ecosystem.

## Ruby Deserves Better Tools

Ruby developers have built extraordinary things: Rails changed how the world
builds web applications. The language's emphasis on developer happiness and
expressive power isn't a liability for serious computing -- it's an asset.

The reason Ruby hasn't been used for ML isn't that it can't express these ideas
well. It's that nobody built the infrastructure. MLX Ruby is that
infrastructure: a complete, native, GPU-accelerated machine learning framework
that treats Ruby as a first-class citizen.

If you've ever wanted to train a model, experiment with neural architectures,
or run LLM inference without leaving Ruby -- now you can.

```bash
gem install mlx
```

[GitHub](https://github.com/skryl/mlx-ruby) |
[Documentation](https://skryl.github.io/mlx-ruby) |
[RubyGems](https://rubygems.org/gems/mlx)

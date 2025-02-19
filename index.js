const express = require("express");
const mongoose = require("mongoose");
const { User } = require("./modals/User");
const { Product } = require("./modals/Product");
const morgan = require("morgan");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { isUser } = require("./middlewares/isUser");
const cors = require("cors");
const { Cart } = require("./modals/Cart");

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

mongoose
  .connect("mongodb://localhost:27017/klecommerce")
  .then(() => {
    console.log("MongoDb Is Connected");
  })
  .catch((err) => {
    console.log("Error COnnected Database ", err);
  });

app.post("/register", async (req, res) => {
  const body = req.body;
  // we are having email , name and password
  const useremail = body.email;
  const name = body.name;
  const password = body.password;
  if (!useremail || !name || !password) {
    res.status(400).json({ message: "Some Fileds Are Missing" });
  }
  const isUserAlreadyExist = await User.findOne({ email: useremail });

  if (isUserAlreadyExist) {
    res.status(400).json({ message: "User Already Have An Account" });
    return;
  } else {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const token = jwt.sign({ email: useremail }, "supersecret", {
      expiresIn: "365d",
    });

    await User.create({
      name: name,
      email: useremail,
      password: hashedPassword,
      token: token,
      role: "user",
    });
    return res.status(201).json({ message: "User Created Succesfully" });
  }
});

app.post("/login", async (req, res) => {
  const body = req.body;
  const email = body.email;
  const password = body.password;
  // we are assuming here that we have email and pasword with us
  // const us
  const user = await User.findOne({ email: email });

  if (user) {
    // if user exist, we have to do something
    const isPasswordMatched = bcrypt.compareSync(password, user.password);
    if (isPasswordMatched == true) {
      res.status(200).json({
        id: user._id,
        name: user.name,
        token: user.token,
        email: user.email,
        role: user.role,
      });
    } else {
      res.status(400).json({ message: "Password Not Matched" });
    }
    // console.log("✌️user --->", user);
    // res.status(200).send("Success");
  } else {
    res
      .status(400)
      .json({ message: "User is Not Registered. Please Register First" });
  }
});

app.get("/products", async (req, res) => {
  console.log("Products");
  const products = await Product.find();
  res.status(200).json({
    products: products,
  });
});

app.post("/add-product", async (req, res) => {
  const body = req.body;
  const name = body.name;
  const { token } = req.headers;
  const decodedtoken = jwt.verify(token, "supersecret");
  console.log("✌️decodedtoken --->", decodedtoken);
  const user = await User.findOne({ email: decodedtoken.email });
  const description = body.description;
  const image = body.image;
  const price = body.price;
  const brand = body.brand;
  const stock = body.stock;
  /// now we aassuming we hace every thing for product
  await Product.create({
    name: name,
    description: description,
    image: image,
    stock: stock,
    brand: brand,
    price: price,
    user: user._id,
  });
  res.status(201).json({
    message: "Product Created Succesfully",
  });
});

app.patch("/product/edit/:id", async (req, res) => {
  const { id } = req.params;
  const { token } = req.headers;
  const body = req.body.productData;
  const name = body.name;
  const description = body.description;
  const image = body.image;
  const price = body.price;
  const brand = body.brand;
  const stock = body.stock;
  const userEmail = jwt.verify(token, "supersecret");
  try {
    console.log({
      name,
      description,
      image,
      price,
      brand,
      stock,
    });
    if (userEmail.email) {
      const updatedProduct = await Product.findByIdAndUpdate(id, {
        name,
        description,
        image,
        price,
        brand,
        stock,
      });
      res.status(200).json({ message: "Product Updated Succesfully" });
    }
  } catch (error) {
    res.status(400).json({
      message: "Internal Server Error Occured While Updating Product",
    });
  }
});

app.get("/product/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400), json({ message: "Product Id Not Found" });
  }
  const { token } = req.headers;
  try {
    const userEmailFromToken = jwt.verify(token, "supersecret");
    if (userEmailFromToken.email) {
      const product = await Product.findById(id);
      if (!product) {
        res.status(400).json({ message: "Product Not Found" });
      }
      res.status(200).json({ message: "Success", product });
    }
  } catch (error) {
    res.status(400).json({
      message: "Internal Server Error Occured while Getting Single Product",
    });
  }
});

app.delete("/product/delete/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).send("Product Id Not Found");
  }

  try {
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).send("Product Not Found");
    }

    res.status(200).json({
      message: "Product Deleted Successfully",
      product: deletedProduct,
    });
  } catch (error) {
    res.status(500).json({ message: "Error Deleting Product", error });
  }
});

app.get("/product/search/:keyword", async (req, res) => {
  const { keyword } = req.params;

  try {
    const products = await Product.find({
      name: { $regex: keyword, $options: "i" },
    });
    // $options: "i"  ==  if product if apple aand we search for ApPle then also it will return same products apple

    if (products.length === 0) {
      return res.status(404).json({ message: "No Products Found" });
    }

    res.status(200).json({
      message: "Products Found",
      products: products,
    });
  } catch (error) {
    res.status(500).json({ message: "Error Searching Products", error });
  }
});

app.post("/cart/add", async (req, res) => {
  const body = req.body;

  const productsArray = body.products;
  let totalPrice = 0;

  try {
    for (const item of productsArray) {
      const product = await Product.findById(item);
      if (product) {
        totalPrice += product.price;
      }
    }

    const { token } = req.headers;
    const decodedToken = jwt.verify(token, "supersecret");
    const user = await User.findOne({ email: decodedToken.email });

    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    let cart;
    if (user.cart) {
      cart = await Cart.findById(user.cart).populate("products");
      const existingProductIds = cart.products.map((product) =>
        product._id.toString()
      );

      productsArray.forEach(async (productId) => {
        if (!existingProductIds.includes(productId)) {
          cart.products.push(productId);
          const product = await Product.findById(productId);
          totalPrice += product.price;
        }
      });

      cart.total = totalPrice;
      await cart.save();
    } else {
      cart = new Cart({
        products: productsArray,
        total: totalPrice,
      });

      await cart.save();
      user.cart = cart._id;
      await user.save();
    }

    res.status(201).json({
      message: "Cart Updated Successfully",
      cart: cart,
    });
  } catch (error) {
    res.status(500).json({ message: "Error Adding to Cart", error });
  }
});

app.get("/cart", async (req, res) => {
  const { token } = req.headers;
  const decodedToken = jwt.verify(token, "supersecret");
  const user = await User.findOne({ email: decodedToken.email }).populate({
    path: "cart",
    populate: {
      path: "products",
      model: "Product",
    },
  });

  if (!user) {
    return res.status(400).send("User Not Found");
  }

  res.status(200).json({ cart: user.cart });
});

app.delete("/cart/product/delete", async (req, res) => {
  const { productID } = req.body;
  const { token } = req.headers;

  try {
    const decodedToken = jwt.verify(token, "supersecret");
    const user = await User.findOne({ email: decodedToken.email }).populate("cart");

    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    const cart = await Cart.findById(user.cart).populate("products");

    if (!cart) {
      return res.status(404).json({ message: "Cart Not Found" });
    }

    const productIndex = cart.products.findIndex(
      (product) => product._id.toString() === productID
    );

    if (productIndex === -1) {
      return res.status(404).json({ message: "Product Not Found in Cart" });
    }

    cart.products.splice(productIndex, 1);
    cart.total = cart.products.reduce(
      (total, product) => total + product.price,
      0
    );

    await cart.save();

    res.status(200).json({
      message: "Product Removed from Cart Successfully",
      cart: cart,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error Removing Product from Cart", error });
  }
});

app.post("/cart/payment", async (req, res) => {});

app.listen(4242, () => {
  console.log("Server is Started on 4242");
});

const { put, del } = require('@vercel/blob');

const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

const uploadToBlob = async (req) => {
  if (!req.files) return;
  const promises = [];

  req.files.forEach((file) => {
    promises.push(
      put(file.filename, file.buffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
      }).catch((error) => error),
    );
  });

  await Promise.all(promises);
};

const deleteBlobWhenUpdate = async (req, Model) => {
  const post = await Model.findById(req.params.id);
  if (post.images.length === 0) return;

  const promises = [];

  post.images.forEach((img) => {
    promises.push(del(img));
  });

  Promise.all(promises);
};

const filterPosts = (docs) => {
  const filteredDocs = docs
    .map((doc) => {
      if (doc.anonim) doc.author = undefined;
      if (doc.isDeleted) doc = undefined;
      return doc;
    })
    .filter((el) => el !== undefined);

  return filteredDocs;
};

exports.deleteOne = (Model) => async (req, res, next) => {
  try {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    // deleteBlobWhenUpdate(req, Model);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateOne = (Model) => async (req, res, next) => {
  try {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    // deleteBlobWhenUpdate(req, Model);
    await uploadToBlob(req);

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createOne = (Model) => async (req, res, next) => {
  try {
    const doc = await Model.create(req.body);

    await uploadToBlob(req);

    res.status(201).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getOne = (Model, populateOptions) => async (req, res, next) => {
  try {
    let query = Model.findById(req.params.id);
    if (populateOptions) query = query.populate(populateOptions);
    const doc = await query;

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    if (doc.anonim) doc.author = undefined;

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getAll = (Model) => async (req, res, next) => {
  try {
    // EXECUTE QUERY
    const features = new APIFeatures(Model.find(), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    const docs = await features.query;

    const finishedDocs = await filterPosts(docs);

    res.status(200).json({
      status: 'success',
      results: finishedDocs.length,
      data: {
        data: finishedDocs,
      },
    });
  } catch (err) {
    next();
  }
};

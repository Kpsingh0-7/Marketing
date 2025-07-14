import axios from 'axios';

export const getTemplateAnalytics = async (req, res) => {
  const {
    start,
    end,
    granularity = 'AGGREGATED',
    metric_types = 'SENT,DELIVERED,READ,CLICKED',
    template_id,
    limit = 30,
  } = req.query;

  if (!template_id) {
    return res
      .status(400)
      .json({ error: 'Missing required parameter: template_id' });
  }

  try {
    const params = new URLSearchParams({
      ...(start && { start }),
      ...(end && { end }),
      granularity,
      metric_types,
      template_ids: template_id,
      limit,
    });

    const url = `https://partner.gupshup.io/partner/app/e6fc2b8d-6e8d-4713-8d91-da5323e400da/template/analytics?${params.toString()}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: 'sk_4830e6e27ce44be5af5892c5913396b8', // or use process.env.TOKEN
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching template analytics:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Internal Server Error',
    });
  }
};
